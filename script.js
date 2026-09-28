/**
 * MEMOIR — A Cozy Digital Journal
 * Vanilla JavaScript Implementation
 * 
 * Organized in clear labeled sections:
 * 1. Storage & State Management
 * 2. Date Utilities
 * 3. Calculations & Stats Engine
 * 4. Section Renderers
 * 5. Entry Panel & CRUD Actions
 * 6. Modal Dialogs & Toasts
 * 7. Navigation & Routing
 * 8. Initialization & Event Delegation
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. STORAGE & STATE MANAGEMENT
     ========================================================================== */

  const STORAGE_KEYS = {
    ENTRIES: 'memoir_entries',
    THEME: 'memoir_theme',
    NAME: 'memoir_name'
  };

  const MOOD_META = {
    happy: { label: 'Happy', emoji: '😊' },
    calm: { label: 'Calm', emoji: '😌' },
    okay: { label: 'Okay', emoji: '😐' },
    sad: { label: 'Sad', emoji: '😔' },
    excited: { label: 'Excited', emoji: '🤩' }
  };

  // Safe wrapper for localStorage access
  const Storage = {
    getEntries() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ENTRIES);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.sort((a, b) => b.date.localeCompare(a.date));
      } catch (err) {
        console.warn('Memoir: Unable to read journal entries from storage, using empty state.', err);
        return [];
      }
    },

    saveEntries(entries) {
      try {
        // Always maintain newest-first order
        const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
        localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(sorted));
        return true;
      } catch (err) {
        console.error('Memoir: Failed to persist entries to storage.', err);
        showToast('Storage error: unable to save entry.');
        return false;
      }
    },

    getTheme() {
      try {
        return localStorage.getItem(STORAGE_KEYS.THEME) || 'coffee';
      } catch (err) {
        return 'coffee';
      }
    },

    saveTheme(theme) {
      try {
        localStorage.setItem(STORAGE_KEYS.THEME, theme);
      } catch (err) {
        console.warn('Memoir: Failed to save theme preference.', err);
      }
    },

    getName() {
      try {
        return localStorage.getItem(STORAGE_KEYS.NAME) || 'Friend';
      } catch (err) {
        return 'Friend';
      }
    },

    saveName(name) {
      try {
        localStorage.setItem(STORAGE_KEYS.NAME, name || 'Friend');
      } catch (err) {
        console.warn('Memoir: Failed to save user name.', err);
      }
    },

    clearAll() {
      try {
        localStorage.removeItem(STORAGE_KEYS.ENTRIES);
        return true;
      } catch (err) {
        console.error('Memoir: Failed to clear entries.', err);
        return false;
      }
    }
  };

  // Application State
  const state = {
    entries: Storage.getEntries(),
    userName: Storage.getName(),
    theme: Storage.getTheme(),
    currentHash: 'dashboard',
    activeEditingDate: null, // YYYY-MM-DD or null (defaults to today)
    calendar: {
      year: new Date().getFullYear(),
      month: new Date().getMonth() // 0-11
    }
  };

  /* ==========================================================================
     2. DATE UTILITIES (Strictly Local Date, Never toISOString for Dates)
     ========================================================================== */

  const DateUtils = {
    // Returns YYYY-MM-DD for any Date object in user's local timezone
    getLocalDateString(d = new Date()) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    // Parse YYYY-MM-DD string into a local Date object safely
    parseLocalDate(str) {
      if (!str || typeof str !== 'string') return new Date();
      const parts = str.split('-');
      if (parts.length !== 3) return new Date();
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    },

    // Friendly formatted date (e.g. "Monday, September 28, 2026")
    formatDisplayDate(dateStr, includeYear = true) {
      const d = DateUtils.parseLocalDate(dateStr);
      const options = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        ...(includeYear ? { year: 'numeric' } : {})
      };
      return d.toLocaleDateString(undefined, options);
    },

    // Short date (e.g. "Sep 28, 2026")
    formatShortDate(dateStr) {
      const d = DateUtils.parseLocalDate(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    },

    // Local greeting based on time of day
    getGreeting() {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return 'Good morning';
      if (hour >= 12 && hour < 17) return 'Good afternoon';
      return 'Good evening';
    },

    // Get date string N calendar days ago (or future if negative)
    getDaysAgoString(n, fromDate = new Date()) {
      const target = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() - n);
      return DateUtils.getLocalDateString(target);
    },

    // Checks if a given YYYY-MM-DD falls into current local week (Monday - Sunday)
    isDateInCurrentWeek(dateStr) {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, ...
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      
      const monStr = DateUtils.getLocalDateString(monday);
      const sunStr = DateUtils.getLocalDateString(sunday);
      return dateStr >= monStr && dateStr <= sunStr;
    }
  };

  // Helper to prevent HTML injection
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ==========================================================================
     3. CALCULATIONS & STATS ENGINE
     ========================================================================== */

  const Stats = {
    // Current streak = consecutive calendar days with an entry, counting back from today.
    // If there is no entry today but there is one yesterday, streak is still alive. Otherwise 0.
    calculateStreak(entries) {
      if (!entries || entries.length === 0) return 0;
      const dateSet = new Set(entries.map(e => e.date));
      const todayStr = DateUtils.getLocalDateString();
      const yesterdayStr = DateUtils.getDaysAgoString(1);

      if (dateSet.has(todayStr)) {
        let streak = 1;
        let dayOffset = 1;
        while (dateSet.has(DateUtils.getDaysAgoString(dayOffset))) {
          streak++;
          dayOffset++;
        }
        return streak;
      } else if (dateSet.has(yesterdayStr)) {
        let streak = 1;
        let dayOffset = 2;
        while (dateSet.has(DateUtils.getDaysAgoString(dayOffset))) {
          streak++;
          dayOffset++;
        }
        return streak;
      }

      return 0;
    },

    // Entries in current week (Mon-Sun)
    calculateThisWeek(entries) {
      return entries.filter(e => DateUtils.isDateInCurrentWeek(e.date)).length;
    },

    // Most common mood (ties: most recent date wins)
    calculateMostCommonMood(entries) {
      if (!entries || entries.length === 0) return null;
      const moodCounts = {};
      const latestPerMood = {};

      for (const entry of entries) {
        const m = entry.mood || 'okay';
        moodCounts[m] = (moodCounts[m] || 0) + 1;
        if (!latestPerMood[m] || entry.date > latestPerMood[m]) {
          latestPerMood[m] = entry.date;
        }
      }

      let bestMood = null;
      let highestCount = -1;

      for (const mood of Object.keys(moodCounts)) {
        const count = moodCounts[mood];
        if (count > highestCount) {
          highestCount = count;
          bestMood = mood;
        } else if (count === highestCount) {
          // Tie-break: most recent wins
          if (latestPerMood[mood] > latestPerMood[bestMood]) {
            bestMood = mood;
          }
        }
      }

      return bestMood ? { mood: bestMood, count: highestCount, meta: MOOD_META[bestMood] } : null;
    },

    // Distribution breakdown for all moods
    calculateMoodDistribution(entries) {
      const total = entries.length;
      const counts = {
        happy: 0,
        calm: 0,
        okay: 0,
        sad: 0,
        excited: 0
      };

      for (const e of entries) {
        if (counts[e.mood] !== undefined) {
          counts[e.mood]++;
        }
      }

      return Object.keys(counts).map(key => {
        const count = counts[key];
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        return {
          key,
          label: MOOD_META[key].label,
          emoji: MOOD_META[key].emoji,
          count,
          percentage
        };
      });
    }
  };

  /* ==========================================================================
     4. SECTION RENDERERS
     ========================================================================== */

  const Render = {
    // Global Header & Profile info
    userProfile() {
      const name = state.userName || 'Friend';
      const initial = (name.trim().charAt(0) || 'F').toUpperCase();
      
      const avatarEl = document.getElementById('sidebar-avatar');
      const nameEl = document.getElementById('sidebar-name');
      const greetingHeading = document.getElementById('greeting-heading');
      const settingNameInput = document.getElementById('settings-name-input');

      if (avatarEl) avatarEl.textContent = initial;
      if (nameEl) nameEl.textContent = name;
      if (greetingHeading) {
        greetingHeading.textContent = `${DateUtils.getGreeting()}, ${name} ☕`;
      }
      if (settingNameInput && document.activeElement !== settingNameInput) {
        settingNameInput.value = name;
      }
    },

    // 1. Dashboard
    dashboard() {
      const streak = Stats.calculateStreak(state.entries);
      const total = state.entries.length;
      const weekCount = Stats.calculateThisWeek(state.entries);

      document.getElementById('dash-streak').textContent = streak;
      document.getElementById('dash-total').textContent = total;
      document.getElementById('dash-week').textContent = weekCount;

      const recentContainer = document.getElementById('dash-recent-list');
      if (!recentContainer) return;

      const recent = state.entries.slice(0, 3);
      if (recent.length === 0) {
        recentContainer.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon" aria-hidden="true">☕</span>
            <h4 class="empty-state-title">No entries yet</h4>
            <p class="empty-state-desc">Pour a cup of coffee and write down your first memory today.</p>
          </div>
        `;
        return;
      }

      recentContainer.innerHTML = recent.map(entry => Render.entryCardHTML(entry, false)).join('');
    },

    // 2. Journal View
    journal() {
      const listContainer = document.getElementById('journal-entries-list');
      if (!listContainer) return;

      if (state.entries.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon" aria-hidden="true">📖</span>
            <h3 class="empty-state-title">Your journal is waiting</h3>
            <p class="empty-state-desc">Your thoughts, reflections, and milestones will be archived here.</p>
            <button type="button" class="btn btn-primary" onclick="window.memoirApp.focusTodayEntry()">
              Start Writing
            </button>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = state.entries.map(entry => Render.entryCardHTML(entry, true)).join('');
    },

    // 3. Calendar View
    calendar() {
      const grid = document.getElementById('calendar-grid');
      const title = document.getElementById('cal-month-year');
      if (!grid || !title) return;

      const { year, month } = state.calendar;
      const monthDate = new Date(year, month, 1);
      title.textContent = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

      // Calendar dates calculation
      const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const prevMonthDays = new Date(year, month, 0).getDate();

      const todayStr = DateUtils.getLocalDateString();
      const entryMap = new Map();
      for (const e of state.entries) {
        entryMap.set(e.date, e);
      }

      let cellsHTML = '';

      // Previous month padding days
      for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevMonthDays - i;
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const dStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const hasEntry = entryMap.has(dStr);

        cellsHTML += `
          <button type="button" class="calendar-day-btn other-month ${hasEntry ? 'has-entry' : ''}" 
                  data-date="${dStr}" 
                  aria-label="${DateUtils.formatDisplayDate(dStr)}${hasEntry ? ' (has entry)' : ''}">
            <span class="day-number">${dayNum}</span>
            ${hasEntry ? '<span class="cal-entry-dot" aria-hidden="true"></span>' : ''}
          </button>
        `;
      }

      // Current month days
      for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dStr === todayStr;
        const hasEntry = entryMap.has(dStr);

        cellsHTML += `
          <button type="button" class="calendar-day-btn ${isToday ? 'is-today' : ''} ${hasEntry ? 'has-entry' : ''}" 
                  data-date="${dStr}" 
                  aria-label="${DateUtils.formatDisplayDate(dStr)}${hasEntry ? ' (has entry)' : ''}"
                  ${isToday ? 'aria-current="date"' : ''}>
            <span class="day-number">${day}</span>
            ${hasEntry ? '<span class="cal-entry-dot" aria-hidden="true"></span>' : ''}
          </button>
        `;
      }

      // Next month padding days to complete grid (up to 42 cells total)
      const totalRendered = firstDayIndex + daysInMonth;
      const nextPadding = totalRendered % 7 === 0 ? 0 : 7 - (totalRendered % 7);
      for (let day = 1; day <= nextPadding; day++) {
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        const dStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasEntry = entryMap.has(dStr);

        cellsHTML += `
          <button type="button" class="calendar-day-btn other-month ${hasEntry ? 'has-entry' : ''}" 
                  data-date="${dStr}" 
                  aria-label="${DateUtils.formatDisplayDate(dStr)}${hasEntry ? ' (has entry)' : ''}">
            <span class="day-number">${day}</span>
            ${hasEntry ? '<span class="cal-entry-dot" aria-hidden="true"></span>' : ''}
          </button>
        `;
      }

      grid.innerHTML = cellsHTML;
    },

    // 4. Memories View
    memories() {
      const searchInput = document.getElementById('memories-search-input');
      const moodFilter = document.getElementById('memories-mood-filter');
      const container = document.getElementById('memories-entries-list');
      const randomBtn = document.getElementById('btn-random-memory');
      if (!container) return;

      if (randomBtn) {
        randomBtn.disabled = state.entries.length === 0;
      }

      if (state.entries.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon" aria-hidden="true">✨</span>
            <h3 class="empty-state-title">No memories stored yet</h3>
            <p class="empty-state-desc">Write your thoughts today, and they will shine brightly here.</p>
          </div>
        `;
        return;
      }

      const query = (searchInput?.value || '').trim().toLowerCase();
      const mood = moodFilter?.value || 'all';

      const filtered = state.entries.filter(entry => {
        if (mood !== 'all' && entry.mood !== mood) return false;
        if (!query) return true;
        const contentMatch = (entry.content || '').toLowerCase().includes(query);
        const highlightMatch = (entry.highlight || '').toLowerCase().includes(query);
        const gratitudeMatch = (entry.gratitude || '').toLowerCase().includes(query);
        return contentMatch || highlightMatch || gratitudeMatch;
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon" aria-hidden="true">🔍</span>
            <h3 class="empty-state-title">No matching memories</h3>
            <p class="empty-state-desc">Try clearing your filters or searching for something else.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(entry => Render.entryCardHTML(entry, true)).join('');
    },

    // 5. Statistics View
    statistics() {
      const streak = Stats.calculateStreak(state.entries);
      const total = state.entries.length;
      const weekCount = Stats.calculateThisWeek(state.entries);
      const commonMood = Stats.calculateMostCommonMood(state.entries);
      const distribution = Stats.calculateMoodDistribution(state.entries);

      document.getElementById('stats-streak').textContent = streak;
      document.getElementById('stats-total').textContent = total;
      document.getElementById('stats-week').textContent = weekCount;

      const moodValEl = document.getElementById('stats-common-mood');
      const moodIconEl = document.getElementById('stats-mood-icon');

      if (commonMood) {
        moodValEl.textContent = `${commonMood.meta.label} (${commonMood.count})`;
        moodIconEl.textContent = commonMood.meta.emoji;
      } else {
        moodValEl.textContent = 'None yet';
        moodIconEl.textContent = '☕';
      }

      const barsContainer = document.getElementById('mood-distribution-bars');
      if (barsContainer) {
        barsContainer.innerHTML = distribution.map(item => `
          <div class="mood-bar-row">
            <div class="mood-bar-header">
              <span>${item.emoji} ${item.label}</span>
              <span>${item.count} (${item.percentage}%)</span>
            </div>
            <div class="mood-bar-track">
              <div class="mood-bar-fill" style="width: ${item.percentage}%;"></div>
            </div>
          </div>
        `).join('');
      }
    },

    // 6. Search View
    search() {
      const input = document.getElementById('global-search-input');
      const resultsContainer = document.getElementById('global-search-results');
      const summaryEl = document.getElementById('search-results-summary');
      if (!input || !resultsContainer || !summaryEl) return;

      const query = input.value.trim().toLowerCase();
      if (!query) {
        summaryEl.textContent = 'Start typing above to search your entire journal history.';
        resultsContainer.innerHTML = '';
        return;
      }

      const matches = state.entries.filter(entry => {
        const contentMatch = (entry.content || '').toLowerCase().includes(query);
        const highlightMatch = (entry.highlight || '').toLowerCase().includes(query);
        const gratitudeMatch = (entry.gratitude || '').toLowerCase().includes(query);
        
        // Mood match (e.g. "calm", "happy")
        const moodName = (MOOD_META[entry.mood]?.label || '').toLowerCase();
        const moodMatch = moodName.includes(query) || (entry.mood || '').toLowerCase().includes(query);

        // Date matches (e.g. "2026-09", "September", "28")
        const dateRawMatch = (entry.date || '').toLowerCase().includes(query);
        const formattedDateMatch = DateUtils.formatDisplayDate(entry.date).toLowerCase().includes(query);

        return contentMatch || highlightMatch || gratitudeMatch || moodMatch || dateRawMatch || formattedDateMatch;
      });

      if (matches.length === 0) {
        summaryEl.textContent = `No results found for "${escapeHTML(query)}"`;
        resultsContainer.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon" aria-hidden="true">🍂</span>
            <h3 class="empty-state-title">No entries match your search</h3>
            <p class="empty-state-desc">Try checking for typos or searching a different term or date.</p>
          </div>
        `;
        return;
      }

      summaryEl.textContent = `Found ${matches.length} matching ${matches.length === 1 ? 'entry' : 'entries'}:`;
      resultsContainer.innerHTML = matches.map(entry => Render.entryCardHTML(entry, true)).join('');
    },

    // Reusable HTML generator for journal entry cards
    entryCardHTML(entry, showActions = true) {
      const mood = MOOD_META[entry.mood] || MOOD_META.okay;
      const formattedDate = DateUtils.formatDisplayDate(entry.date);
      
      // Snippet: ~120 characters preview
      const content = entry.content || '';
      const isLong = content.length > 120;
      const snippet = isLong ? content.slice(0, 120).trim() + '...' : content;

      return `
        <article class="entry-card" data-entry-id="${entry.id}" data-date="${entry.date}">
          <header class="entry-card-header">
            <div class="entry-date-badge">
              <span class="entry-mood-badge" title="${mood.label}">${mood.emoji}</span>
              <time datetime="${entry.date}">${formattedDate}</time>
            </div>
            ${showActions ? `
              <div class="entry-card-actions">
                <button type="button" class="btn btn-subtle btn-sm btn-edit-entry" data-date="${entry.date}" aria-label="Edit entry for ${formattedDate}">
                  ✏️ Edit
                </button>
                <button type="button" class="btn btn-danger btn-sm btn-delete-entry" data-date="${entry.date}" aria-label="Delete entry for ${formattedDate}">
                  🗑️ Delete
                </button>
              </div>
            ` : `
              <button type="button" class="btn btn-subtle btn-sm btn-edit-entry" data-date="${entry.date}" aria-label="Open entry for ${formattedDate}">
                Open →
              </button>
            `}
          </header>

          ${snippet ? `<div class="entry-card-body">${escapeHTML(snippet)}</div>` : ''}

          ${(entry.highlight || entry.gratitude) ? `
            <div class="entry-meta-tags">
              ${entry.highlight ? `<span class="tag-badge tag-highlight">✨ <strong>Highlight:</strong> ${escapeHTML(entry.highlight)}</span>` : ''}
              ${entry.gratitude ? `<span class="tag-badge tag-gratitude">🙏 <strong>Grateful:</strong> ${escapeHTML(entry.gratitude)}</span>` : ''}
            </div>
          ` : ''}

          <footer class="entry-card-footer">
            <span class="entry-updated-at">
              ${entry.updatedAt ? `Last modified: ${new Date(entry.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </footer>
        </article>
      `;
    },

    // Refresh all dynamic sections
    all() {
      Render.userProfile();
      Render.dashboard();
      Render.journal();
      Render.calendar();
      Render.memories();
      Render.statistics();
      Render.search();
    }
  };

  /* ==========================================================================
     5. ENTRY PANEL & CRUD ACTIONS
     ========================================================================== */

  const EntryController = {
    // Open entry form for a specific target date (defaults to today)
    loadEntryForDate(targetDate) {
      const todayStr = DateUtils.getLocalDateString();
      const dateToLoad = targetDate || todayStr;
      state.activeEditingDate = dateToLoad;

      const titleEl = document.getElementById('panel-title-text');
      const dateDisplay = document.getElementById('panel-date-display');
      const cancelBtn = document.getElementById('btn-cancel-edit');
      const hiddenDateInput = document.getElementById('entry-target-date');
      const contentInput = document.getElementById('entry-content');
      const highlightInput = document.getElementById('entry-highlight');
      const gratitudeInput = document.getElementById('entry-gratitude');
      const errorEl = document.getElementById('entry-form-error');

      // Clear errors
      if (errorEl) {
        errorEl.classList.add('hidden');
        errorEl.textContent = '';
      }

      hiddenDateInput.value = dateToLoad;
      dateDisplay.textContent = DateUtils.formatDisplayDate(dateToLoad);

      const isToday = dateToLoad === todayStr;
      const existingEntry = state.entries.find(e => e.date === dateToLoad);

      if (isToday) {
        titleEl.textContent = existingEntry ? "Today's Entry (Edit)" : "Today's Entry";
        cancelBtn.classList.add('hidden');
      } else {
        titleEl.textContent = existingEntry ? "Edit Entry" : "New Past Entry";
        cancelBtn.classList.remove('hidden');
      }

      if (existingEntry) {
        // Populate existing values
        contentInput.value = existingEntry.content || '';
        highlightInput.value = existingEntry.highlight || '';
        gratitudeInput.value = existingEntry.gratitude || '';
        
        const moodRadio = document.querySelector(`input[name="entry-mood"][value="${existingEntry.mood || 'happy'}"]`);
        if (moodRadio) moodRadio.checked = true;
      } else {
        // Blank form
        contentInput.value = '';
        highlightInput.value = '';
        gratitudeInput.value = '';
        const defaultMood = document.querySelector('input[name="entry-mood"][value="happy"]');
        if (defaultMood) defaultMood.checked = true;
      }
    },

    // Save entry (New or Update)
    saveEntry(e) {
      if (e) e.preventDefault();

      const targetDate = document.getElementById('entry-target-date').value || DateUtils.getLocalDateString();
      const moodRadio = document.querySelector('input[name="entry-mood"]:checked');
      const mood = moodRadio ? moodRadio.value : 'happy';

      const content = document.getElementById('entry-content').value.trim();
      const highlight = document.getElementById('entry-highlight').value.trim();
      const gratitude = document.getElementById('entry-gratitude').value.trim();
      const errorEl = document.getElementById('entry-form-error');

      // Requirement: Block saving if content, highlight, and gratitude are all empty.
      // Mood alone is not enough.
      if (!content && !highlight && !gratitude) {
        if (errorEl) {
          errorEl.textContent = 'Please write some thoughts, a highlight, or gratitude before saving.';
          errorEl.classList.remove('hidden');
        }
        return false;
      }

      if (errorEl) {
        errorEl.classList.add('hidden');
      }

      const existingIndex = state.entries.findIndex(entry => entry.date === targetDate);
      const nowIso = new Date().toISOString();

      if (existingIndex > -1) {
        // Update existing entry
        const existing = state.entries[existingIndex];
        state.entries[existingIndex] = {
          ...existing,
          mood,
          content,
          highlight,
          gratitude,
          updatedAt: nowIso
        };
      } else {
        // Create new entry
        const newEntry = {
          id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          date: targetDate,
          mood,
          content,
          highlight,
          gratitude,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        state.entries.push(newEntry);
      }

      // Persist to storage
      Storage.saveEntries(state.entries);

      // Reload fresh entries (maintains newest first order)
      state.entries = Storage.getEntries();

      // Show auto-dismissing toast
      showToast('Entry saved ☕');

      // Refresh form & dynamic UI
      EntryController.loadEntryForDate(targetDate);
      Render.all();

      return true;
    },

    // Delete single entry
    deleteEntry(date) {
      const entry = state.entries.find(e => e.date === date);
      if (!entry) return;

      const formatted = DateUtils.formatDisplayDate(date);
      Modal.confirm({
        title: 'Delete Journal Entry',
        message: `Are you sure you want to permanently delete your entry for ${formatted}? This cannot be undone.`,
        confirmText: 'Delete',
        onConfirm: () => {
          state.entries = state.entries.filter(e => e.date !== date);
          Storage.saveEntries(state.entries);
          
          // If we were editing that deleted entry, reset form to today
          if (state.activeEditingDate === date) {
            EntryController.loadEntryForDate(DateUtils.getLocalDateString());
          }

          Render.all();
          showToast('Entry removed ☕');
        }
      });
    },

    // Focus today's entry panel (for the big button on dashboard)
    focusToday() {
      EntryController.loadEntryForDate(DateUtils.getLocalDateString());
      const panel = document.getElementById('entry-panel');
      const textarea = document.getElementById('entry-content');
      if (textarea) textarea.focus();
      if (panel && window.innerWidth < 1100) {
        panel.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  /* ==========================================================================
     6. MODAL DIALOGS & TOASTS
     ========================================================================== */

  let toastTimer = null;
  function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }

    toast.textContent = message;
    toast.classList.remove('hidden');

    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
      toastTimer = null;
    }, duration);
  }

  const Modal = {
    currentConfirmCallback: null,

    confirm({ title, message, confirmText = 'Confirm', onConfirm }) {
      const dialog = document.getElementById('confirm-dialog');
      const titleEl = document.getElementById('dialog-title');
      const messageEl = document.getElementById('dialog-message');
      const confirmBtn = document.getElementById('dialog-btn-confirm');

      if (!dialog) {
        // Fallback if dialog tag unavailable
        if (window.confirm(message)) {
          if (onConfirm) onConfirm();
        }
        return;
      }

      titleEl.textContent = title;
      messageEl.textContent = message;
      confirmBtn.textContent = confirmText;
      Modal.currentConfirmCallback = onConfirm;

      dialog.showModal();
    },

    close() {
      const dialog = document.getElementById('confirm-dialog');
      if (dialog && dialog.open) {
        dialog.close();
      }
      Modal.currentConfirmCallback = null;
    }
  };

  /* ==========================================================================
     7. NAVIGATION & ROUTING
     ========================================================================== */

  const Router = {
    routes: ['dashboard', 'journal', 'calendar', 'memories', 'statistics', 'search', 'settings'],

    navigate(hash) {
      const cleanHash = (hash || '').replace(/^#/, '').toLowerCase();
      const targetRoute = Router.routes.includes(cleanHash) ? cleanHash : 'dashboard';

      state.currentHash = targetRoute;

      // Update active nav link
      const navLinks = document.querySelectorAll('.nav-link');
      navLinks.forEach(link => {
        const isCurrent = link.getAttribute('data-section') === targetRoute;
        link.classList.toggle('active', isCurrent);
        if (isCurrent) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });

      // Show target view section, hide others
      const sections = document.querySelectorAll('.view-section');
      sections.forEach(section => {
        const matches = section.id === `section-${targetRoute}`;
        section.classList.toggle('active', matches);
      });

      // Scroll to top of main content
      window.scrollTo(0, 0);

      // Section-specific refresh
      if (targetRoute === 'dashboard') Render.dashboard();
      if (targetRoute === 'journal') Render.journal();
      if (targetRoute === 'calendar') Render.calendar();
      if (targetRoute === 'memories') Render.memories();
      if (targetRoute === 'statistics') Render.statistics();
      if (targetRoute === 'search') Render.search();
    },

    init() {
      window.addEventListener('hashchange', () => {
        Router.navigate(window.location.hash);
      });
      // Handle initial load
      Router.navigate(window.location.hash || 'dashboard');
    }
  };

  /* ==========================================================================
     8. INITIALIZATION & EVENT DELEGATION
     ========================================================================== */

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    Storage.saveTheme(theme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.checked = theme === 'dark';
    }
  }

  function exportData() {
    try {
      const dataStr = JSON.stringify(state.entries, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dateStr = DateUtils.getLocalDateString();
      const a = document.createElement('a');
      a.href = url;
      a.download = `memoir-export-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Export downloaded ☕');
    } catch (err) {
      console.error('Memoir: Export failed', err);
      showToast('Export failed. Please try again.');
    }
  }

  function setupEventListeners() {
    // 1. Entry Form Save
    const entryForm = document.getElementById('entry-form');
    if (entryForm) {
      entryForm.addEventListener('submit', EntryController.saveEntry);
    }

    // 2. Cancel Edit button
    const cancelEditBtn = document.getElementById('btn-cancel-edit');
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => {
        EntryController.loadEntryForDate(DateUtils.getLocalDateString());
      });
    }

    // 3. Write Today's Entry button on Dashboard
    const writeTodayBtn = document.getElementById('btn-write-today');
    if (writeTodayBtn) {
      writeTodayBtn.addEventListener('click', () => {
        EntryController.focusToday();
      });
    }

    // 4. Calendar Controls
    const calPrev = document.getElementById('cal-prev-month');
    const calNext = document.getElementById('cal-next-month');
    const calToday = document.getElementById('cal-today-btn');

    if (calPrev) {
      calPrev.addEventListener('click', () => {
        if (state.calendar.month === 0) {
          state.calendar.month = 11;
          state.calendar.year--;
        } else {
          state.calendar.month--;
        }
        Render.calendar();
      });
    }

    if (calNext) {
      calNext.addEventListener('click', () => {
        if (state.calendar.month === 11) {
          state.calendar.month = 0;
          state.calendar.year++;
        } else {
          state.calendar.month++;
        }
        Render.calendar();
      });
    }

    if (calToday) {
      calToday.addEventListener('click', () => {
        const now = new Date();
        state.calendar.year = now.getFullYear();
        state.calendar.month = now.getMonth();
        Render.calendar();
        EntryController.loadEntryForDate(DateUtils.getLocalDateString());
      });
    }

    // 5. Calendar Grid Click (Delegation)
    const calGrid = document.getElementById('calendar-grid');
    if (calGrid) {
      calGrid.addEventListener('click', e => {
        const btn = e.target.closest('.calendar-day-btn');
        if (!btn) return;
        const targetDate = btn.getAttribute('data-date');
        if (targetDate) {
          EntryController.loadEntryForDate(targetDate);
          const panel = document.getElementById('entry-panel');
          if (panel && window.innerWidth < 1100) {
            panel.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    }

    // 6. Memories Toolbar: Search & Filter
    const memoriesSearch = document.getElementById('memories-search-input');
    const memoriesFilter = document.getElementById('memories-mood-filter');
    const randomMemBtn = document.getElementById('btn-random-memory');

    if (memoriesSearch) {
      memoriesSearch.addEventListener('input', () => Render.memories());
    }
    if (memoriesFilter) {
      memoriesFilter.addEventListener('change', () => Render.memories());
    }
    if (randomMemBtn) {
      randomMemBtn.addEventListener('click', () => {
        if (state.entries.length === 0) {
          showToast('No memories found to explore yet!');
          return;
        }
        const randomIndex = Math.floor(Math.random() * state.entries.length);
        const randomEntry = state.entries[randomIndex];
        EntryController.loadEntryForDate(randomEntry.date);
        showToast(`Loaded memory from ${DateUtils.formatShortDate(randomEntry.date)} ✨`);
        const panel = document.getElementById('entry-panel');
        if (panel && window.innerWidth < 1100) {
          panel.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    // 7. Global Search Box (Live as you type)
    const globalSearchInput = document.getElementById('global-search-input');
    if (globalSearchInput) {
      globalSearchInput.addEventListener('input', () => Render.search());
    }

    // 8. Settings: Theme toggle, Name change, Export, Clear All
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('change', () => {
        applyTheme(themeToggle.checked ? 'dark' : 'coffee');
      });
    }

    const saveNameBtn = document.getElementById('btn-save-name');
    const nameInput = document.getElementById('settings-name-input');
    if (saveNameBtn && nameInput) {
      saveNameBtn.addEventListener('click', () => {
        const val = nameInput.value.trim() || 'Friend';
        state.userName = val;
        Storage.saveName(val);
        Render.userProfile();
        showToast('Name updated ☕');
      });
      nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          saveNameBtn.click();
        }
      });
    }

    const exportBtn = document.getElementById('btn-export-json');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportData);
    }

    const clearBtn = document.getElementById('btn-clear-data');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        Modal.confirm({
          title: 'Reset All Journal Data?',
          message: 'This will permanently remove all your journal entries from this browser. This action cannot be reversed.',
          confirmText: 'Clear Everything',
          onConfirm: () => {
            Storage.clearAll();
            state.entries = [];
            EntryController.loadEntryForDate(DateUtils.getLocalDateString());
            Render.all();
            showToast('All journal data has been cleared.');
          }
        });
      });
    }

    // 9. Modal Dialog Controls
    const dialogCancel = document.getElementById('dialog-btn-cancel');
    const dialogConfirm = document.getElementById('dialog-btn-confirm');
    const dialog = document.getElementById('confirm-dialog');

    if (dialogCancel) {
      dialogCancel.addEventListener('click', () => Modal.close());
    }
    if (dialogConfirm) {
      dialogConfirm.addEventListener('click', () => {
        if (typeof Modal.currentConfirmCallback === 'function') {
          Modal.currentConfirmCallback();
        }
        Modal.close();
      });
    }
    if (dialog) {
      // Close on backdrop click
      dialog.addEventListener('click', e => {
        if (e.target === dialog) Modal.close();
      });
    }

    // 10. Global Event Delegation for Dynamic Entry Lists (Edit & Delete buttons)
    document.addEventListener('click', e => {
      // Edit Button
      const editBtn = e.target.closest('.btn-edit-entry');
      if (editBtn) {
        const targetDate = editBtn.getAttribute('data-date');
        if (targetDate) {
          EntryController.loadEntryForDate(targetDate);
          const panel = document.getElementById('entry-panel');
          if (panel && window.innerWidth < 1100) {
            panel.scrollIntoView({ behavior: 'smooth' });
          }
        }
        return;
      }

      // Delete Button
      const deleteBtn = e.target.closest('.btn-delete-entry');
      if (deleteBtn) {
        const targetDate = deleteBtn.getAttribute('data-date');
        if (targetDate) {
          EntryController.deleteEntry(targetDate);
        }
        return;
      }
    });
  }

  // App Bootstrap
  function init() {
    // Apply saved theme immediately
    applyTheme(state.theme);

    // Initial render
    Render.all();

    // Load entry panel for today
    EntryController.loadEntryForDate(DateUtils.getLocalDateString());

    // Setup routes & listeners
    Router.init();
    setupEventListeners();

    // Expose helpers for debugging/inspection
    window.memoirApp = {
      state,
      Storage,
      DateUtils,
      Stats,
      Render,
      Router,
      EntryController,
      focusTodayEntry: EntryController.focusToday
    };
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
