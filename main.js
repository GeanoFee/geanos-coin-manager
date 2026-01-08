Hooks.once("init", () => {
  // Einstellung registrieren: Soll Electrum genutzt werden?
  game.settings.register("geanos-coin-manager", "useElectrum", {
    name: "Electrum (EP) berücksichtigen?",
    hint: "Wenn deaktiviert, wird Electrum beim Umrechnen ignoriert und in Gold/Silber aufgeteilt.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
});

Hooks.on("preUpdateActor", (actor, update) => {
  const currencyUpdate = getProperty(update, "system.currency");
  if (!currencyUpdate || actor.type !== "character") return;

  const currentCurrency = { ...actor.system.currency };
  const useEP = game.settings.get("geanos-coin-manager", "useElectrum");

  // 1. Mathematische Operationen verarbeiten (+5, -10 etc.)
  for (let [denom, value] of Object.entries(currencyUpdate)) {
    if (typeof value === "string") {
      if (value.startsWith("+") || value.startsWith("-")) {
        currentCurrency[denom] += parseInt(value);
      } else {
        currentCurrency[denom] = parseInt(value);
      }
    } else {
      currentCurrency[denom] = value;
    }
  }

  // 2. Alles in die kleinste Einheit (Copper) umrechnen
  let totalCopper = 
    (currentCurrency.cp || 0) +
    (currentCurrency.sp || 0) * 10 +
    (currentCurrency.ep || 0) * 50 +
    (currentCurrency.gp || 0) * 100 +
    (currentCurrency.pp || 0) * 1000;

  if (totalCopper < 0) totalCopper = 0;

  // 3. Verteilung auf die Einheiten (Verdichtung)
  const finalCurrency = {
    pp: Math.floor(totalCopper / 1000),
    gp: 0,
    ep: 0,
    sp: 0,
    cp: 0
  };
  
  let remainder = totalCopper % 1000;

  if (useEP) {
    // Mit Electrum-Logik
    finalCurrency.gp = Math.floor(remainder / 100);
    remainder %= 100;
    finalCurrency.ep = Math.floor(remainder / 50);
    remainder %= 50;
    finalCurrency.sp = Math.floor(remainder / 10);
    finalCurrency.cp = remainder % 10;
  } else {
    // Ohne Electrum (EP wird übersprungen)
    finalCurrency.gp = Math.floor(remainder / 100);
    remainder %= 100;
    finalCurrency.sp = Math.floor(remainder / 10);
    finalCurrency.cp = remainder % 10;
    finalCurrency.ep = 0; 
  }

  update.system.currency = finalCurrency;
});