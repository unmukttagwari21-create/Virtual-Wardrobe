(() => {
  const STORAGE_KEY = "closetMuse_v1";
  const MAX_IMAGE_BYTES = 900 * 1024;
  const defaults = { items: [], outfits: [] };
  let state = loadState();
  let activeCategory = "All";
  let selectedForOutfit = {};
  let inspirationDataUrl = "";
  let inspirationColor = null;
  let currentMatches = [];
  let toastTimer;

  const $ = (id) => document.getElementById(id);
  const categoryEmoji = { Tops: "👚", Bottoms: "👖", Dresses: "👗", Shoes: "👟", Accessories: "👜" };

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return structuredClone(defaults);
      const parsed = JSON.parse(saved);
      return {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        outfits: Array.isArray(parsed.outfits) ? parsed.outfits : []
      };
    } catch (error) {
      console.warn("Could not read wardrobe storage.", error);
      return structuredClone(defaults);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      showToast("Browser storage is full. Try a smaller photo or remove an item.");
      return false;
    }
  }

  function makeId() {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function showToast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2600);
  }

  function updateStats() {
    $("total-count").textContent = state.items.length;
    $("outfit-count").textContent = state.outfits.length;
    $("favorite-count").textContent = state.items.filter(item => item.favorite).length;
  }

  function itemImage(item) {
    return item.photo
      ? `<img src="${item.photo}" alt="${escapeHtml(item.name)}">`
      : `<div class="photo-placeholder" aria-hidden="true">${categoryEmoji[item.category] || "✧"}</div>`;
  }

  function cardMarkup(item) {
    return `<article class="item-card">
      <button class="heart ${item.favorite ? "liked" : ""}" data-action="favorite" data-id="${item.id}" aria-label="${item.favorite ? "Remove from" : "Add to"} favorites">${item.favorite ? "♥" : "♡"}</button>
      <div class="item-photo">${itemImage(item)}</div>
      <div class="item-info">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-meta"><span class="pill">${escapeHtml(item.category)}</span><span>${escapeHtml(item.color || "—")}</span></div>
        <button class="delete-item" data-action="delete" data-id="${item.id}">Remove piece</button>
      </div>
    </article>`;
  }

  function emptyMarkup(title, message, buttonText = "") {
    return `<div class="empty"><div class="big">✧</div><h3>${title}</h3><p>${message}</p>${buttonText ? `<button class="primary" id="empty-add">${buttonText}</button>` : ""}</div>`;
  }

  function renderCloset() {
    const query = $("search").value.trim().toLowerCase();
    const items = state.items.filter(item =>
      (activeCategory === "All" || item.category === activeCategory) &&
      `${item.name} ${item.category} ${item.color}`.toLowerCase().includes(query)
    );
    $("closet-grid").innerHTML = items.length
      ? items.map(cardMarkup).join("")
      : emptyMarkup("Your closet starts here", "Add your first clothing piece to begin building your digital wardrobe.", "＋ Add a piece");
    $("favorites-grid").innerHTML = state.items.filter(item => item.favorite).length
      ? state.items.filter(item => item.favorite).map(cardMarkup).join("")
      : emptyMarkup("No favorites just yet", "Tap the heart on any piece to keep it close.");
    updateStats();
  }

  function renderPicker() {
    const category = $("picker-category").value;
    const items = state.items.filter(item => item.category === category);
    $("picker-list").innerHTML = items.length ? items.map(item => `
      <div class="picker-item ${selectedForOutfit[category] === item.id ? "selected" : ""}" data-pick="${item.id}" data-category="${category}" role="button" tabindex="0">
        ${item.photo ? `<img src="${item.photo}" alt="">` : `<div class="mini-placeholder">${categoryEmoji[category] || "✧"}</div>`}
        <span>${escapeHtml(item.name)}<br><span style="color:#8b857b">${escapeHtml(item.color || "")}</span></span>
      </div>`).join("") : `<p class="notice">No ${category.toLowerCase()} yet. Add some in My closet first.</p>`;
  }

  function renderBoard() {
    document.querySelectorAll(".outfit-slot").forEach(slot => {
      const category = slot.dataset.slot;
      const item = state.items.find(x => x.id === selectedForOutfit[category]);
      if (!item) {
        slot.innerHTML = `<span style="font-size:27px">＋</span><span>${category === "Dresses" ? "Or choose a dress" : "Choose " + (category === "Bottoms" ? "a bottom" : category === "Shoes" ? "shoes" : category === "Tops" ? "a top" : "accessories")}</span>`;
      } else {
        slot.innerHTML = `${item.photo ? `<img src="${item.photo}" alt="${escapeHtml(item.name)}">` : `<span style="font-size:38px">${categoryEmoji[category] || "✧"}</span>`}<strong>${escapeHtml(item.name)}</strong><button class="delete-item" data-clear-slot="${category}">Remove</button>`;
      }
    });
  }

  function renderSavedOutfits() {
    $("saved-outfits").innerHTML = state.outfits.length ? state.outfits.map(outfit => {
      const items = outfit.itemIds.map(id => state.items.find(item => item.id === id)).filter(Boolean);
      return `<article class="saved-outfit"><h3>${escapeHtml(outfit.name)}</h3><p>${items.length} piece${items.length === 1 ? "" : "s"}</p>
        <div class="saved-thumbs">${items.map(item => item.photo ? `<img src="${item.photo}" alt="${escapeHtml(item.name)}" title="${escapeHtml(item.name)}">` : `<div class="mini-placeholder" title="${escapeHtml(item.name)}">${categoryEmoji[item.category] || "✧"}</div>`).join("")}</div>
        <button class="secondary danger" data-delete-outfit="${outfit.id}">Delete look</button></article>`;
    }).join("") : emptyMarkup("No looks saved", "Build a combination in the studio and save it here.");
  }

  function getImageAverageColor(source) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const size = 32;
          canvas.width = size; canvas.height = size;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(image, 0, 0, size, size);
          const pixels = context.getImageData(0, 0, size, size).data;
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] < 80) continue;
            // Down-weight near-white/near-black pixels slightly less by keeping all opaque pixels.
            r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count++;
          }
          resolve(count ? { r: r / count, g: g / count, b: b / count } : null);
        } catch (error) { resolve(null); }
      };
      image.onerror = () => resolve(null);
      image.src = source;
    });
  }

  function colorDistance(a, b) {
    if (!a || !b) return 999;
    // Weighted RGB distance; lower means more similar.
    const rMean = (a.r + b.r) / 2;
    const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
    return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
  }

  function rgbToHex(c) {
    if (!c) return "#dedbd1";
    return "#" + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  }

  async function findInspirationMatches() {
    if (!inspirationDataUrl) { showToast("Upload an inspiration photo first."); return; }
    if (!state.items.length) { showToast("Add some clothing pieces to your closet first."); return; }
    const button = $("find-matches");
    button.disabled = true; button.textContent = "Matching colors…";
    inspirationColor = await getImageAverageColor(inspirationDataUrl);
    if (!inspirationColor) {
      button.disabled = false; button.textContent = "Find similar pieces";
      showToast("Could not analyze this image. Try another photo."); return;
    }
    const focus = $("inspo-focus").value;
    const eligible = state.items.filter(item => item.photo && (focus === "All" || item.category === focus));
    const scored = await Promise.all(eligible.map(async item => ({
      item,
      color: await getImageAverageColor(item.photo)
    })));
    const ranked = scored.filter(entry => entry.color).map(entry => ({
      ...entry,
      distance: colorDistance(inspirationColor, entry.color)
    })).sort((a, b) => a.distance - b.distance);
    currentMatches = [];
    if (focus === "All") {
      const wanted = ["Tops", "Bottoms", "Dresses", "Shoes", "Accessories"];
      wanted.forEach(category => {
        const categoryItems = ranked.filter(entry => entry.item.category === category);
        if (categoryItems.length) currentMatches.push(categoryItems[0]);
      });
      // A dress is an alternative to a top + bottom, so avoid suggesting all three together.
      if (currentMatches.some(entry => entry.item.category === "Dresses")) {
        currentMatches = currentMatches.filter(entry => !["Tops", "Bottoms"].includes(entry.item.category));
      }
    } else {
      currentMatches = ranked.slice(0, 6);
    }
    const swatches = $("inspo-swatches");
    swatches.innerHTML = `<span class="swatch" title="Average inspiration color" style="background:${rgbToHex(inspirationColor)}"></span>`;
    const results = $("match-results");
    if (!currentMatches.length) {
      results.innerHTML = emptyMarkup("No photo matches yet", "Add photos to your wardrobe items and try again.");
      $("match-description").textContent = "No uploaded clothing photos were available to compare.";
      $("use-matches").disabled = true; $("save-matches").disabled = true;
    } else {
      results.innerHTML = currentMatches.map(entry => {
        const similarity = Math.max(1, Math.round(100 - Math.min(99, entry.distance / 4.4)));
        return `<article class="match-card"><div class="item-photo">${itemImage(entry.item)}</div><div class="item-info"><div class="item-name">${escapeHtml(entry.item.name)}</div><div class="item-meta"><span class="pill">${escapeHtml(entry.item.category)}</span></div><div class="match-score">Color match · ${similarity}%</div></div></article>`;
      }).join("");
      $("match-description").textContent = `Found ${currentMatches.length} closest color match${currentMatches.length === 1 ? "" : "es"} from your closet. These are color-based suggestions, not an AI understanding of the outfit.`;
      $("use-matches").disabled = false; $("save-matches").disabled = false;
    }
    button.disabled = false; button.textContent = "Find similar pieces";
  }

  function applyMatchesToStudio() {
    selectedForOutfit = {};
    currentMatches.forEach(entry => { selectedForOutfit[entry.item.category] = entry.item.id; });
    setView("outfits");
    renderPicker(); renderBoard();
    showToast("Matches added to Outfit Studio.");
  }

  function saveMatchesAsOutfit() {
    const itemIds = [...new Set(currentMatches.map(entry => entry.item.id))];
    if (!itemIds.length) return;
    const name = `Inspired look ${state.outfits.length + 1}`;
    state.outfits.unshift({ id: makeId(), name, itemIds });
    if (!saveState()) { state.outfits.shift(); return; }
    renderAll(); showToast("Inspired outfit saved ✧");
  }

  function renderAll() {
    renderCloset();
    renderPicker();
    renderBoard();
    renderSavedOutfits();
  }

  function openModal() {
    $("add-modal").classList.add("open");
    $("item-name").focus();
  }
  function closeModal() {
    $("add-modal").classList.remove("open");
    $("add-form").reset();
  }

  function setView(name) {
    document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
    $(`${name}-view`).classList.add("active");
    document.querySelectorAll(".nav button").forEach(button => button.classList.toggle("active", button.dataset.view === name));
    if (name === "favorites") renderCloset();
    if (name === "outfits") { renderPicker(); renderBoard(); renderSavedOutfits(); }
    if (name === "inspiration") { renderCloset(); }
  }

  $("open-add").addEventListener("click", openModal);
  $("close-modal").addEventListener("click", closeModal);
  $("add-modal").addEventListener("click", event => { if (event.target === $("add-modal")) closeModal(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
  document.querySelectorAll(".nav button").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));

  $("category-tabs").addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab === button));
    renderCloset();
  });
  $("search").addEventListener("input", renderCloset);

  $("inspo-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Please choose an image file."); event.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { showToast("Please choose an inspiration photo under 5 MB."); event.target.value = ""; return; }
    inspirationDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }).catch(() => "");
    if (!inspirationDataUrl) { showToast("Could not read that image."); return; }
    $("inspo-preview").innerHTML = `<img src="${inspirationDataUrl}" alt="Uploaded outfit inspiration">`;
    $("find-matches").disabled = false;
    $("match-results").innerHTML = "";
    $("match-description").textContent = "Ready to compare the colors in your inspiration with photos in your closet.";
    $("use-matches").disabled = true; $("save-matches").disabled = true;
    currentMatches = [];
  });
  $("find-matches").addEventListener("click", findInspirationMatches);
  $("use-matches").addEventListener("click", applyMatchesToStudio);
  $("save-matches").addEventListener("click", saveMatchesAsOutfit);

  $("add-form").addEventListener("submit", async event => {
    event.preventDefault();
    const name = $("item-name").value.trim();
    if (!name) return;
    const file = $("item-photo").files[0];
    let photo = "";
    if (file) {
      if (!file.type.startsWith("image/")) { showToast("Please choose an image file."); return; }
      if (file.size > MAX_IMAGE_BYTES) {
        showToast("That photo is large. Please choose one under 900 KB.");
        return;
      }
      photo = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }).catch(() => "");
      if (!photo && file) { showToast("Could not read that photo. Try another."); return; }
    }
    const item = {
      id: makeId(),
      name,
      category: $("item-category").value,
      color: $("item-color").value,
      photo,
      favorite: false
    };
    state.items.unshift(item);
    if (!saveState()) { state.items.shift(); return; }
    closeModal();
    renderAll();
    showToast("Added to your closet ✧");
  });

  document.body.addEventListener("click", event => {
    const favoriteButton = event.target.closest("[data-action='favorite']");
    if (favoriteButton) {
      const item = state.items.find(x => x.id === favoriteButton.dataset.id);
      if (item) { item.favorite = !item.favorite; saveState(); renderAll(); }
      return;
    }
    const deleteButton = event.target.closest("[data-action='delete']");
    if (deleteButton) {
      const item = state.items.find(x => x.id === deleteButton.dataset.id);
      if (!item) return;
      if (!confirm(`Remove "${item.name}" from your closet?`)) return;
      state.items = state.items.filter(x => x.id !== item.id);
      Object.keys(selectedForOutfit).forEach(category => { if (selectedForOutfit[category] === item.id) delete selectedForOutfit[category]; });
      state.outfits.forEach(outfit => { outfit.itemIds = outfit.itemIds.filter(id => id !== item.id); });
      state.outfits = state.outfits.filter(outfit => outfit.itemIds.length > 0);
      saveState(); renderAll(); showToast("Piece removed.");
      return;
    }
    const picker = event.target.closest("[data-pick]");
    if (picker) {
      const category = picker.dataset.category;
      const id = picker.dataset.pick;
      if (selectedForOutfit[category] === id) delete selectedForOutfit[category];
      else selectedForOutfit[category] = id;
      renderPicker(); renderBoard();
      return;
    }
    const clearSlot = event.target.closest("[data-clear-slot]");
    if (clearSlot) {
      delete selectedForOutfit[clearSlot.dataset.clearSlot];
      renderPicker(); renderBoard();
      return;
    }
    const deleteOutfit = event.target.closest("[data-delete-outfit]");
    if (deleteOutfit) {
      state.outfits = state.outfits.filter(outfit => outfit.id !== deleteOutfit.dataset.deleteOutfit);
      saveState(); renderAll(); showToast("Look deleted.");
      return;
    }
    if (event.target.id === "empty-add") openModal();
  });

  $("picker-list").addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-pick]")) {
      event.preventDefault();
      event.target.click();
    }
  });
  $("picker-category").addEventListener("change", renderPicker);

  $("save-outfit").addEventListener("click", () => {
    const itemIds = [...new Set(Object.values(selectedForOutfit))];
    if (!itemIds.length) { showToast("Choose at least one piece first."); return; }
    const name = $("outfit-name").value.trim() || `Look ${state.outfits.length + 1}`;
    state.outfits.unshift({ id: makeId(), name, itemIds });
    if (!saveState()) { state.outfits.shift(); return; }
    $("outfit-name").value = "";
    selectedForOutfit = {};
    renderAll();
    showToast("Your look has been saved ✧");
  });

  renderAll();
})();
