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

Hooks.on("preUpdateActor", (actor, update) => {
  const currencyUpdate = getProperty(update, "system.currency");
  if (!currencyUpdate || actor.type !== "character") return;

  const enableMath = game.settings.get("geanos-coin-manager", "enableMath");
  const enableOptimization = game.settings.get("geanos-coin-manager", "enableOptimization");
  const useEP = game.settings.get("geanos-coin-manager", "useElectrum");

  if (!enableMath && !enableOptimization) return;

  const currentCurrency = { ...actor.system.currency };

  // 1. Incorporate updates (handling Math if enabled)
  for (let [denom, value] of Object.entries(currencyUpdate)) {
    if (enableMath && typeof value === "string" && (value.startsWith("+") || value.startsWith("-"))) {
      const newVal = (currentCurrency[denom] || 0) + parseInt(value);
      currentCurrency[denom] = newVal;
      // Write resolved value back to update object so it persists even if optimization is skipped
      update.system.currency[denom] = newVal;
    } else {
      // Standard update (replace value)
      // Ensure we treat it as a number for our optimization calculations
      currentCurrency[denom] = Number(value);
    }
  }

  // 2. Optimization
  if (enableOptimization) {
    let totalCopper =
      (currentCurrency.cp || 0) +
      (currentCurrency.sp || 0) * 10 +
      (currentCurrency.ep || 0) * 50 +
      (currentCurrency.gp || 0) * 100 +
      (currentCurrency.pp || 0) * 1000;

    if (totalCopper < 0) totalCopper = 0;

    const finalCurrency = {
      pp: Math.floor(totalCopper / 1000),
      gp: 0,
      ep: 0,
      sp: 0,
      cp: 0
    };

    let remainder = totalCopper % 1000;

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

    update.system.currency = finalCurrency;
  }
});