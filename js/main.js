"use strict"

const legalDescriptionBox = document.getElementById("legal-description");
const mapCanvas = document.getElementById("map-canvas");
const mapContext = mapCanvas.getContext("2d");

const instructions = {
	"begin": {
		matchWords: [/commencing/, /beginning (on|at)/],
		function: () => { state = "begin"; }
	},
	"north": {
		matchWords: [/north\b/, /northerly/, /\bn\b/, /northward/, /northwards/],
		function: () => { adjective = "north"; }
	},
	"south": {
		matchWords: [/south\b/, /southerly/, /\bs\b/, /southward/, /southwards/],
		function: () => { adjective = "south"; }
	},
	"east": {
		matchWords: [/east\b/, /easterly/, /\b\b/, /eastward/, /eastwards/],
		function: () => { adjective = "east"; }
	},
	"west": {
		matchWords: [/west\b/, /westerly/, /\bw\b/, /westward/, /westwards/],
		function: () => { adjective = "west"; }
	},
	"north-east": {
		matchWords: [/north-east\b/, /north east/, /northeast/ /north-easterly/, /\bne\b/],
		function: () => { adjective = "north-east"; }
	},
	"north-west": {
		matchWords: [/north-west\b/, /north west/, /northwest/, /northwesterly/, /\bnw\b/],
		function: () => { adjective = "north-west"; }
	},
	"south-east": {
		matchWords: [/south-east\b/, /south east/, /southeast/, /southeasterly/, /\bse\b/],
		function: () => { adjective = "south-east"; }
	},
	"south-west": {
		matchWords: [/south-west\b/, /south west/, /southwest/, /southwesterly/, /\bsw\b/],
		function: () => { adjective = "south-west"; }
	},
};
let adjective = "";
let state = "";

function updateMap() {
	const legalDescription = legalDescriptionBox.value;
	mapContext.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

	if (legalDescription.length > 0) {
		/* Strip commas and periods from the legal description */
		legalDescription = legalDescription.replace(/[,.]/g, "");
		const words = legalDescription.split(" ");
		let wordBuffer = "";
		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			wordBuffer += word + " ";
			const instruction = instructions.keys().find(x => instructions[x].some(y => wordBuffer.match(new RegExp(y, 'i'))));
			if (instruction) {
				wordBuffer = "";
				instructions[instruction].function();
			}
		}
	}
}
legalDescriptionBox.addEventListener("change", updateMap);
