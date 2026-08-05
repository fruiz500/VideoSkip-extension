//for opening one item at a time in the Help screen, with animation[cite: 4]
function openHelp() {
	const helpItems = document.getElementsByClassName('helpitem');
	for (let i = 0; i < helpItems.length; i++) {					//hide all help texts[cite: 4]
		const panel = helpItems[i].nextElementSibling;
		panel.style.maxHeight = null;
	}
	const activePanel = this.nextElementSibling;							//except for the one clicked[cite: 4]
	activePanel.style.maxHeight = activePanel.scrollHeight + "px";
}

window.onload = function () {
	const helpHeaders = document.getElementsByClassName("helpitem");		//add listeners to all the help headers[cite: 4]

	for (let i = 0; i < helpHeaders.length; i++) {
		helpHeaders[i].addEventListener('click', openHelp);
	}
};