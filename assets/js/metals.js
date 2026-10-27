/* The Orbit Post metals.js — gold and silver board: re-prices the
   any-currency weight tables when the reader picks a currency. No
   inline scripts: the FX rates ride on the container's data-rates
   attribute (emitted by generator.py from data/fx.json) and every
   cell carries its USD value in data-usd. All arithmetic is local;
   there are no external calls. External file, covered by
   script-src 'self'. */
(function () {
  "use strict";

  function fmtMoney(v) {
    if (v === null || v === undefined || isNaN(v)) return "n/a";
    if (v >= 1000) {
      return v.toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (v >= 10) return v.toFixed(2);
    return String(parseFloat(v.toPrecision(4)));
  }

  var wrap = document.querySelector(".mt-any");
  if (!wrap) return;
  var rates = {};
  try { rates = JSON.parse(wrap.getAttribute("data-rates") || "{}"); }
  catch (e) { rates = {}; }
  rates.USD = 1;
  var sel = document.getElementById("mt-cur");
  if (!sel) return;

  function update() {
    var rate = rates[sel.value];
    if (!rate) return;
    var cells = wrap.querySelectorAll("td[data-usd]");
    Array.prototype.forEach.call(cells, function (td) {
      var usd = parseFloat(td.getAttribute("data-usd"));
      td.textContent = fmtMoney(usd * rate);
    });
    var heads = wrap.querySelectorAll(".mt-any-code");
    Array.prototype.forEach.call(heads, function (th) {
      th.textContent = sel.value;
    });
  }
  sel.addEventListener("change", update);
  update();
})();
