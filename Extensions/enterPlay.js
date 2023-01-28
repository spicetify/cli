// NAME: Enter Search
// AUTHOR: Nicola Pace
// VERSION: 0.1
// DESCRIPTION: Simple tool to play the first searched song pressing the enter key

/// <reference path="../globals.d.ts" />

(function EnterSearch() {

    sidebarSearchItem = document.querySelector(`.main-navBar-navBar a[href="/search"]`);
    if (!sidebarSearchItem) {
		setTimeout(EnterSearch, 100);
		return;
	}
    
    
    formSearch=document.querySelector("form[role='search']");
    if (!document.querySelector("form[role='search']")) {
		setTimeout(EnterSearch, 100);
		return;
	}
    
    document.querySelector("form[role='search']").addEventListener("submit", function(event) {

        searchPlayButton=document.querySelector(".main-playButton-PlayButton button[aria-label='Play']");
        if(!searchPlayButton){
            document.querySelector(".search-searchResult-topResult a").click();
        }else{
            const searchInput = document.querySelector("form[role='search'] input");
		
            searchInput.blur();
            searchPlayButton.click();
            searchInput.focus();
        }
        
       
        
    });

    sidebarSearchItem.addEventListener("click", function(event) {
        setTimeout(EnterSearch, 100);
		return;
    });


})();