/* The Orbit Post fx.js — exchange rates board interactions: the
   currency converter and the rates-table filter. No inline scripts:
   the rates ride on the converter container's data-rates attribute
   (emitted by generator.py from data/fx.json). All arithmetic is
   local; there are no external calls. External file, covered by
   script-src 'self'. */
(function () {
  "use strict";

  function fmtFx(v) {
    if (v === null || v === undefined || isNaN(v)) return "n/a";
    if (v >= 1000) {
      return v.toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (v >= 10) return v.toFixed(2);
    if (v >= 0.0001) return String(parseFloat(v.toPrecision(4)));
    return v.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  }

  var conv = document.querySelector(".fx-conv");
  if (conv) {
    var rates = {};
    try { rates = JSON.parse(conv.getAttribute("data-rates") || "{}"); }
    catch (e) { rates = {}; }
    rates.USD = 1;
    var amount = document.getElementById("fx-amount");
    var from = document.getElementById("fx-from");
    var to = document.getElementById("fx-to");
    var result = document.getElementById("fx-result");
    function compute() {
      if (!amount || !from || !to || !result) return;
      var amt = parseFloat(amount.value);
      var rf = rates[from.value];
      var rt = rates[to.value];
      if (isNaN(amt) || !rf || !rt) { result.textContent = ""; return; }
      var out = amt / rf * rt;
      result.textContent = fmtFx(amt) + " " + from.value + " = " +
        fmtFx(out) + " " + to.value;
    }
    [amount, from, to].forEach(function (el) {
      if (!el) return;
      el.addEventListener("input", compute);
      el.addEventListener("change", compute);
    });
    compute();
  }

  var filter = document.getElementById("fx-filter");
  var table = document.getElementById("fx-table");
  if (filter && table) {
    filter.addEventListener("input", function () {
      var q = filter.value.trim().toLowerCase();
      var rows = table.querySelectorAll("tbody tr");
      Array.prototype.forEach.call(rows, function (row) {
        var hay = row.getAttribute("data-q") || "";
        row.style.display = (!q || hay.indexOf(q) !== -1) ? "" : "none";
      });
    });
  }
})();
