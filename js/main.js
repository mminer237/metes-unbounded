"use strict"

const legalDescriptionBox = document.getElementById("legal-description");
const mapCanvas = document.getElementById("map-canvas");
const mapContext = mapCanvas.getContext("2d");

function updateMap() {
	const legalDescription = legalDescriptionBox.value;
	mapContext.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

	if (legalDescription.length > 0) {
		
	}
}
legalDescriptionBox.addEventListener("change", updateMap);
