//for opening one item at a time in the Help screen, with animation
function openHelp(){
	var helpItems = document.getElementsByClassName('helpitem');
	for(var i = 0; i < helpItems.length; i++){					//hide all help texts
		var panel = helpItems[i].nextElementSibling;
		panel.style.maxHeight = null;
	}
	var panel = this.nextElementSibling;							//except for the one clicked
	panel.style.maxHeight = panel.scrollHeight + "px"	     
}

window.onload = function() {
	var helpHeaders = document.getElementsByClassName("helpitem");		//add listeners to all the help headers

	for (var i = 0; i < helpHeaders.length; i++) {
		helpHeaders[i].addEventListener('click', openHelp);
	}
}