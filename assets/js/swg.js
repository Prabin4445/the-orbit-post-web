// Reader Revenue Manager (Subscribe with Google, basic) for The Orbit Post.
// Queues the newsletter signup prompt init until Google's swg-basic.js has
// loaded. Publication CAow5f7hCw, product "openaccess" (Publisher Center).
// Configured 2026-10-13: newsletter signup prompt only, no paywall.
(self.SWG_BASIC = self.SWG_BASIC || []).push(function (basicSubscriptions) {
  basicSubscriptions.init({
    type: "NewsArticle",
    isPartOfType: ["Product"],
    isPartOfProductId: "CAow5f7hCw:openaccess",
    clientOptions: { theme: "light", lang: "en" }
  });
});
