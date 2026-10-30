(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const state = {
    user: null,
    page: 1,
    pages: 1,
    search: "",
    category: "",
    tag: "",
    posts: [],
    current: null, // post open in the view dialog
    editingId: null,
    authMode: "login",
  };

  // ---------- helpers ----------
  async function api(path, options = {}) {
    let res;
    try {
      res = await fetch("/api" + path, {
        method: options.method || "GET",
        headers: options.body ? { "Content-Type": "application/json" } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined,
        credentials: "same-origin",
      });
    } catch (e) {
      throw new Error("Cannot reach the server. Check your connection and try again.");
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const err = new Error(data.message || "Something went wrong. Please try again.");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    children.forEach((c) => c && node.append(c));
    return node;
  }

  const fmtDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  let toastTimer;
  function toast(msg, isError = false) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.toggle("error", isError);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
  }

  function showError(id, msg) {
    const p = $(id);
    p.textContent = msg;
    p.classList.remove("hidden");
  }
  const clearError = (id) => $(id).classList.add("hidden");

  const isMine = (post) => state.user && post.author && post.author.id === state.user.id;

  // ---------- auth area ----------
  function renderAuth() {
    const area = $("auth-area");
    area.replaceChildren();
    if (state.user) {
      area.append(
        el("span", { class: "hello", text: "Hi, " + state.user.name }),
        el("button", { class: "btn btn-primary", type: "button", text: "New post", onclick: () => openEditor() }),
        el("button", { class: "btn btn-ghost", type: "button", text: "Log out", onclick: logout })
      );
    } else {
      area.append(
        el("button", { class: "btn btn-ghost", type: "button", text: "Log in", onclick: () => openAuth("login") }),
        el("button", { class: "btn btn-primary", type: "button", text: "Sign up", onclick: () => openAuth("register") })
      );
    }
  }

  function openAuth(mode) {
    state.authMode = mode;
    const reg = mode === "register";
    $("auth-title").textContent = reg ? "Create account" : "Log in";
    $("auth-submit").textContent = reg ? "Sign up" : "Log in";
    $("switch-text").textContent = reg ? "Already have an account?" : "New here?";
    $("auth-switch").textContent = reg ? "Log in" : "Create an account";
    $("name-row").classList.toggle("hidden", !reg);
    $("pw-hint").classList.toggle("hidden", !reg);
    $("auth-password").autocomplete = reg ? "new-password" : "current-password";
    clearError("auth-error");
    if (!$("auth-dialog").open) $("auth-dialog").showModal();
    (reg ? $("auth-name") : $("auth-email")).focus();
  }

  $("auth-switch").addEventListener("click", () => openAuth(state.authMode === "login" ? "register" : "login"));

  $("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError("auth-error");
    const reg = state.authMode === "register";
    const name = $("auth-name").value.trim();
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;

    if (reg && name.length < 2) return showError("auth-error", "Please enter your name (at least 2 characters).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return showError("auth-error", "Please enter a valid email address.");
    if (reg && password.length < 8) return showError("auth-error", "Password must be at least 8 characters.");
    if (!reg && !password) return showError("auth-error", "Please enter your password.");

    const btn = $("auth-submit");
    btn.disabled = true;
    try {
      const data = await api(reg ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: reg ? { name, email, password } : { email, password },
      });
      state.user = data.user;
      $("auth-form").reset();
      $("auth-dialog").close();
      renderAuth();
      toast(reg ? "Welcome, " + data.user.name + "!" : "Logged in.");
      loadPosts();
    } catch (err) {
      showError("auth-error", err.message);
    } finally {
      btn.disabled = false;
    }
  });

  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch (e) { /* ignore */ }
    state.user = null;
    renderAuth();
    loadPosts();
    toast("Logged out.");
  }

  async function checkSession() {
    try {
      const data = await api("/auth/me");
      state.user = data.user;
    } catch (e) {
      state.user = null;
    }
    renderAuth();
  }

  // ---------- listing ----------
  function renderFilters() {
    const box = $("active-filters");
    box.replaceChildren();
    if (state.tag) {
      box.append(
        el("span", { class: "filter-chip" }, document.createTextNode("#" + state.tag),
          el("button", { type: "button", "aria-label": "Remove tag filter", text: "×", onclick: () => { state.tag = ""; state.page = 1; loadPosts(); } }))
      );
    }
  }

  async function loadCategories() {
    try {
      const { categories } = await api("/posts/categories");
      const sel = $("category-filter");
      sel.replaceChildren(el("option", { value: "", text: "All categories" }));
      categories.forEach((c) => sel.append(el("option", { value: c, text: c })));
      sel.value = categories.includes(state.category) ? state.category : "";
      if (sel.value !== state.category) state.category = sel.value;
      const dl = $("category-list");
      dl.replaceChildren();
      categories.forEach((c) => dl.append(el("option", { value: c })));
    } catch (e) { /* filter is optional */ }
  }

  async function loadPosts() {
    const status = $("status");
    status.classList.remove("error");
    status.textContent = "Loading posts...";
    renderFilters();

    const params = new URLSearchParams({ page: state.page });
    if (state.search) params.set("search", state.search);
    if (state.category) params.set("category", state.category);
    if (state.tag) params.set("tag", state.tag);

    try {
      const data = await api("/posts?" + params.toString());
      state.posts = data.posts;
      state.pages = data.pages;
      if (state.page > data.pages) { state.page = data.pages; return loadPosts(); }
      status.textContent = data.total
        ? data.total + (data.total === 1 ? " post" : " posts")
        : "";
      renderPosts();
      renderPager();
    } catch (err) {
      state.posts = [];
      $("posts").replaceChildren();
      $("pager").classList.add("hidden");
      status.textContent = err.message;
      status.classList.add("error");
    }
  }

  function renderPosts() {
    const box = $("posts");
    box.replaceChildren();
    if (!state.posts.length) {
      const filtered = state.search || state.category || state.tag;
      box.append(el("div", { class: "empty", text: filtered ? "No posts match your search." : "No posts yet. Be the first to write one!" }));
      return;
    }
    state.posts.forEach((p) => {
      const tags = el("div", { class: "tags" });
      p.tags.forEach((t) =>
        tags.append(el("button", { class: "tag", type: "button", text: "#" + t, onclick: () => { state.tag = t; state.page = 1; loadPosts(); } }))
      );
      const card = el("article", { class: "post-card" },
        el("span", { class: "chip", text: p.category }),
        el("h3", {}, el("button", { type: "button", text: p.title, onclick: () => openPost(p.id) })),
        el("p", { class: "excerpt", text: p.excerpt }),
        tags,
        el("div", { class: "card-foot" },
          el("span", { class: "meta", text: p.author.name + " · " + fmtDate(p.createdAt) }),
          isMine(p) ? el("span", { class: "mine", text: "YOURS" }) : null)
      );
      box.append(card);
    });
  }

  function renderPager() {
    $("pager").classList.toggle("hidden", state.pages <= 1);
    $("page-info").textContent = "Page " + state.page + " of " + state.pages;
    $("prev-page").disabled = state.page <= 1;
    $("next-page").disabled = state.page >= state.pages;
  }

  $("prev-page").addEventListener("click", () => { state.page--; loadPosts(); $("posts").focus(); });
  $("next-page").addEventListener("click", () => { state.page++; loadPosts(); $("posts").focus(); });

  let debounce;
  $("search-input").addEventListener("input", (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; loadPosts(); }, 300);
  });
  $("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(debounce);
    state.search = $("search-input").value.trim();
    state.page = 1;
    loadPosts();
  });
  $("category-filter").addEventListener("change", (e) => { state.category = e.target.value; state.page = 1; loadPosts(); });

  // ---------- view post ----------
  async function openPost(id) {
    try {
      const { post } = await api("/posts/" + id);
      state.current = post;
      $("view-title").textContent = post.title;
      $("view-meta").textContent = post.author.name + " · " + fmtDate(post.createdAt) + " · " + post.category +
        (post.updatedAt !== post.createdAt && new Date(post.updatedAt) - new Date(post.createdAt) > 1000 ? " · edited" : "");
      const tags = $("view-tags");
      tags.replaceChildren();
      post.tags.forEach((t) =>
        tags.append(el("button", { class: "tag", type: "button", text: "#" + t, onclick: () => { $("view-dialog").close(); state.tag = t; state.page = 1; loadPosts(); } }))
      );
      $("view-content").textContent = post.content;
      $("view-actions").classList.toggle("hidden", !isMine(post));
      $("view-dialog").showModal();
    } catch (err) {
      toast(err.message, true);
      loadPosts();
    }
  }

  $("view-edit").addEventListener("click", () => {
    const post = state.current;
    $("view-dialog").close();
    openEditor(post);
  });

  $("view-delete").addEventListener("click", async () => {
    const post = state.current;
    if (!post || !confirm('Delete "' + post.title + '"? This cannot be undone.')) return;
    try {
      await api("/posts/" + post.id, { method: "DELETE" });
      $("view-dialog").close();
      toast("Post deleted.");
      await loadCategories();
      loadPosts();
    } catch (err) {
      toast(err.message, true);
      if (err.status === 401) { state.user = null; renderAuth(); }
    }
  });

  // ---------- create / edit ----------
  function openEditor(post) {
    if (!state.user) return openAuth("login");
    state.editingId = post ? post.id : null;
    $("editor-title").textContent = post ? "Edit post" : "New post";
    $("editor-submit").textContent = post ? "Save changes" : "Publish";
    $("post-title").value = post ? post.title : "";
    $("post-category").value = post ? post.category : "";
    $("post-tags").value = post ? post.tags.join(", ") : "";
    $("post-content").value = post ? post.content : "";
    clearError("editor-error");
    $("editor-dialog").showModal();
    $("post-title").focus();
  }

  $("editor-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError("editor-error");
    const title = $("post-title").value.trim();
    const content = $("post-content").value.trim();
    const category = $("post-category").value.trim();
    const tags = $("post-tags").value;

    if (title.length < 3) return showError("editor-error", "Title must be at least 3 characters.");
    if (content.length < 10) return showError("editor-error", "Content must be at least 10 characters.");

    const btn = $("editor-submit");
    btn.disabled = true;
    try {
      const editing = state.editingId;
      await api(editing ? "/posts/" + editing : "/posts", {
        method: editing ? "PUT" : "POST",
        body: { title, content, category, tags },
      });
      $("editor-dialog").close();
      toast(editing ? "Post updated." : "Post published.");
      if (!editing) { state.page = 1; state.search = ""; state.category = ""; state.tag = ""; $("search-input").value = ""; }
      await loadCategories();
      loadPosts();
    } catch (err) {
      showError("editor-error", err.message);
      if (err.status === 401) { state.user = null; renderAuth(); }
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- dialogs: close buttons + click on backdrop ----------
  document.querySelectorAll("dialog").forEach((dlg) => {
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
      if (e.target.closest("[data-close]")) dlg.close();
    });
  });

  // ---------- start ----------
  (async function init() {
    await checkSession();
    await loadCategories();
    loadPosts();
  })();
})();
