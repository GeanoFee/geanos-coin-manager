console.log("Geano Coin Manager | Module Loaded!");

Hooks.on("preUpdateActor", (actor, update) => {
  // Check if currency is being updated
  const currencyUpdate = foundry.utils.getProperty(update, "system.currency");
  if (!currencyUpdate || actor.type !== "character") return;

  // Check Optimization Setting
  const enableOptimization = game.settings.get("geanos-coin-manager", "enableOptimization");
  if (!enableOptimization) return;

  // AVOID INFINITE LOOPS:
  // If the update contains ALL keys (pp, gp, ep, sp, cp), we assume it's already optimized/handled by our hijack.
  // Standard updates usually only contain the changed key (e.g. { cp: 105 }).
  // However, dragging/dropping currency might update multiple.
  // Let's check a flag or just do it idempotent.

  // Simplest check: is it already optimized?
  // We can just run the math. If result is same as input, no change.

  // Calculate New Total Wealth
  // We need to merge current actor data with the update delta
  const currentCurrency = actor.system.currency;
  const newCurrency = { ...currentCurrency, ...currencyUpdate };

  let totalCp =
    (newCurrency.cp || 0) +
    (newCurrency.sp || 0) * 10 +
    (newCurrency.ep || 0) * 50 +
    (newCurrency.gp || 0) * 100 +
    (newCurrency.pp || 0) * 1000;

  // Optimization Logic
  const useEP = game.settings.get("geanos-coin-manager", "useElectrum");
  const finalCurrency = {
    pp: Math.floor(totalCp / 1000),
    gp: 0, ep: 0, sp: 0, cp: 0
  };
  let remainder = totalCp % 1000;

  if (useEP) {
    finalCurrency.gp = Math.floor(remainder / 100);
    remainder %= 100;
    finalCurrency.ep = Math.floor(remainder / 50);
    remainder %= 50;
    finalCurrency.sp = Math.floor(remainder / 10);
    finalCurrency.cp = remainder % 10;
  } else {
    finalCurrency.gp = Math.floor(remainder / 100);
    remainder %= 100;
    finalCurrency.sp = Math.floor(remainder / 10);
    finalCurrency.cp = remainder % 10;
    finalCurrency.ep = 0;
  }

  // Apply changes to the Update Object (In-Place)
  // This ensures we do not trigger another update
  update.system.currency = finalCurrency;
});

Hooks.once("init", () => {
  // New Settings: Enable Math & Enable Optimization
  game.settings.register("geanos-coin-manager", "enableMath", {
    name: "Enable Math Operations",
    hint: "Allow using + and - for currency updates (e.g., +10 gp).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("geanos-coin-manager", "enableOptimization", {
    name: "Enable Currency Optimization",
    hint: "Automatically convert currencies to the most efficient denominations (e.g., 100 cp -> 1 gp).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // Existing Setting
  game.settings.register("geanos-coin-manager", "useElectrum", {
    name: "Use Electrum (EP)?",
    hint: "If disabled, Electrum will be ignored during conversion and split into Gold/Silver. Only applies if Optimization is enabled.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
});

// UI Fixes
const fixInput = (input) => {
  if (input.type !== "text") {
    input.setAttribute("type", "text");
    input.removeAttribute("min");
    input.removeAttribute("step");
    input.removeAttribute("data-dtype");
  }
};

const applyCurrencyFix = (element) => {
  const enableMath = game.settings.get("geanos-coin-manager", "enableMath");
  if (!enableMath) return;
  const $el = (element instanceof HTMLElement) ? $(element) : element;
  const inputs = $el.find('input[name^="system.currency"]');
  if (inputs.length > 0) {
    inputs.each(function () {
      fixInput(this);
      $(this).on("focus", function () { fixInput(this); });
    });
  }
};

Hooks.on("renderApplication", (app, html, data) => applyCurrencyFix((html instanceof HTMLElement) ? html : html[0]));
Hooks.on("renderActorSheet", (app, html, data) => applyCurrencyFix((html instanceof HTMLElement) ? html : html[0]));
document.addEventListener("focus", (event) => {
  const target = event.target;
  if (target && target.name && target.name.startsWith("system.currency")) fixInput(target);
}, true);


// ------------------------------------------------------------------
// NUCLEAR OPTION: Hijack with Robust ID Parsing
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// NUCLEAR OPTION: Hijack with Robust ID Parsing
// ------------------------------------------------------------------

const handleCurrencyChange = async (event) => {
  const target = event.target;

  // Filter relevant events
  if (!target || !target.name) return;
  if (!target.name.startsWith("system.currency")) return;

  // Check if we are already processing this target to prevent double-firing
  if (target.dataset.processing === "true") return;

  const enableMath = game.settings.get("geanos-coin-manager", "enableMath");
  const enableOpt = game.settings.get("geanos-coin-manager", "enableOptimization");

  console.warn(`Geano: Settings Check - Math: ${enableMath}, Optimization: ${enableOpt}`);

  // if (!enableMath) return; // REMOVED - We handle it inside conditionally

  // Robust Actor Finder
  const path = event.composedPath ? event.composedPath() : [];
  let actor = null;

  for (const el of path) {
    if (!(el instanceof HTMLElement)) continue;

    // 1. Direct Document ID (Standard Foundry)
    if (el.dataset.documentId) {
      const doc = game.actors.get(el.dataset.documentId);
      if (doc) { actor = doc; break; }
    }

    // 2. ID String Parsing (D&D 5e v2 Sheet)
    // e.g. "CharacterActorSheet-Actor-XmaJf8BGYEjMghkE"
    if (el.id && el.id.includes("Actor-")) {
      const match = el.id.match(/Actor-([a-zA-Z0-9]{16})/);
      if (match && match[1]) {
        const doc = game.actors.get(match[1]);
        if (doc) { actor = doc; break; }
      }
    }

    // 3. App UUID (often used in V2)
    if (el.dataset.uuid) {
      const doc = await fromUuid(el.dataset.uuid);
      if (doc && doc.documentName === "Actor") {
        actor = doc;
        break;
      }
    }

    // 4. Window App ID Lookup
    if (el.dataset.appid) {
      const appId = parseInt(el.dataset.appid);
      if (!isNaN(appId) && ui.windows[appId]) {
        const app = ui.windows[appId];
        actor = app.document || app.object || app.actor;
        if (actor) break;
      }
    }

    // 5. Class-based Open Window Matching (Last Resort)
    if (el.classList.contains("app") || el.classList.contains("window-app")) {
      const foundApp = Object.values(ui.windows).find(app => {
        const appEl = (app.element instanceof HTMLElement) ? app.element : app.element[0];
        return appEl === el || appEl.contains(el);
      });
      if (foundApp) {
        actor = foundApp.document || foundApp.object || foundApp.actor;
        if (actor) break;
      }
    }
  }

  if (actor) {
    // LOCK THE INPUT
    target.dataset.processing = "true";

    try {
      // Manual Math Logic
      const key = target.name.split(".").pop();
      const getVal = (k) => Number(foundry.utils.getProperty(actor, `system.currency.${k}`) || 0);

      const currentVal = getVal(key);
      let valString = target.value;
      let delta = parseInt(valString);

      if (!isNaN(delta)) {
        let newVal;
        const isRelative = valString.trim().startsWith("+") || valString.trim().startsWith("-");

        if (enableMath && isRelative) {
          // Math Enabled: Add
          newVal = currentVal + delta;
        } else {
          // Math Disabled OR Absolute Value: Set Directly
          newVal = delta;
        }

        // Prevent default
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Check Optimization Setting
        const enableOptimization = game.settings.get("geanos-coin-manager", "enableOptimization");

        if (enableOptimization) {
          // Calculate Total Wealth in CP based on the PROPOSED change
          // We use 'newVal' for the changed coin, and 'getVal()' for others.

          let totalCp = 0;
          const multipliers = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

          // Iterate all currencies to sum up
          for (const [denom, mult] of Object.entries(multipliers)) {
            if (denom === key) {
              totalCp += newVal * mult;
            } else {
              totalCp += getVal(denom) * mult;
            }
          }

          if (totalCp < 0) {
            ui.notifications.warn("Not enough currency!");
            // Revert visually? Or just set to 0?
            // Setting to 0 is safest for now.
            totalCp = 0;
          }

          // Distribute
          const useEP = game.settings.get("geanos-coin-manager", "useElectrum");
          const finalCurrency = {
            pp: Math.floor(totalCp / 1000),
            gp: 0, ep: 0, sp: 0, cp: 0
          };
          let remainder = totalCp % 1000;

          if (useEP) {
            finalCurrency.gp = Math.floor(remainder / 100);
            remainder %= 100;
            finalCurrency.ep = Math.floor(remainder / 50);
            remainder %= 50;
            finalCurrency.sp = Math.floor(remainder / 10);
            finalCurrency.cp = remainder % 10;
          } else {
            finalCurrency.gp = Math.floor(remainder / 100);
            remainder %= 100;
            finalCurrency.sp = Math.floor(remainder / 10);
            finalCurrency.cp = remainder % 10;
            finalCurrency.ep = 0;
          }

          // Send full currency object to update all fields at once
          await actor.update({ "system.currency": finalCurrency });

        } else {
          // NO OPTIMIZATION
          if (newVal >= 0) {
            await actor.update({ [target.name]: newVal });
          } else {
            // Clamp negative to 0 if optimization is off
            await actor.update({ [target.name]: 0 });
          }
        }

        if (target.blur) target.blur();
      }
    } finally {
      target.dataset.processing = "false";
    }
  }
};

// Listen for CHANGE only (Keydown was causing double-fire on Enter)
document.addEventListener("change", handleCurrencyChange, true);
