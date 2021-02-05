// @ts-check
// NAME: Shows/News Remover
// AUTHOR: georgwacker
// VERSION: 1.0

/// <reference path="../globals.d.ts" />

(function RemoveShownews() {
    const glue = document.querySelector(".glue-page-wrapper");
	if (!glue) {
		setTimeout(RemoveShownews, 100);
		return;
	}
    let shownews = Array.prototype.slice.call(document.querySelectorAll('.GlueSectionDivider__title'))
    .filter(function (el) {
        return (el.textContent === 'Short News' || el.textContent === 'Shows to try')
    })[0];

    let qarouselshownews = shownews.parentElement.parentElement.parentElement.parentElement;
    qarouselshownews.remove();
})();