"use strict"

const legalDescriptionBox = document.getElementById("legal-description");
const legalDescriptionError = document.getElementById("legal-description-error");
const mapCanvas = document.getElementById("map-canvas");
const mapContext = mapCanvas.getContext("2d");

const instructions = {
	"begin": {
		matchWords: [/commencing/, /beginning (on|at)/],
		function: () => { state.status = "begin"; },
		type: "command"
	},
	"north": {
		matchWords: [/north\b/, /northerly/, /\bn\b/, /northward/, /northwards/],
		function: () => { state.adjective = "north"; },
		type: "adjective"
	},
	"south": {
		matchWords: [/south\b/, /southerly/, /\bs\b/, /southward/, /southwards/],
		function: () => { state.adjective = "south"; },
		type: "adjective"
	},
	"east": {
		matchWords: [/east\b/, /easterly/, /\be\b/, /eastward/, /eastwards/],
		function: () => { state.adjective = "east"; },
		type: "adjective"
	},
	"west": {
		matchWords: [/west\b/, /westerly/, /\bw\b/, /westward/, /westwards/],
		function: () => { state.adjective = "west"; },
		type: "adjective"
	},
	"north-east": {
		matchWords: [/north-east\b/, /north east/, /northeast/, /north-easterly/, /\bne\b/],
		function: () => { state.adjective = "north-east"; },
		type: "adjective"
	},
	"north-west": {
		matchWords: [/north-west\b/, /north west/, /northwest/, /northwesterly/, /\bnw\b/],
		function: () => { state.adjective = "north-west"; },
		type: "adjective"
	},
	"south-east": {
		matchWords: [/south-east\b/, /south east/, /southeast/, /southeasterly/, /\bse\b/],
		function: () => { state.adjective = "south-east"; },
		type: "adjective"
	},
	"south-west": {
		matchWords: [/south-west\b/, /south west/, /southwest/, /southwesterly/, /\bsw\b/],
		function: () => { state.adjective = "south-west"; },
		type: "adjective"
	},
	"corner": {
		matchWords: [/corner/],
		function: () => { state.status = "corner"; },
		type: "point"
	},
	"quarter": {
		matchWords: [/quarter/],
		function: () => {
			state.zoomBox("quarter", state.adjective);
			state.status = "begin";
			state.adjective = "";
		},
		type: "part"
	},
	"half": {
		matchWords: [/half/],
		function: () => {
			state.zoomBox("half", state.adjective);
			state.status = "begin";
			state.adjective = "";
		},
		type: "part"
	},
	"of": {
		matchWords: [/\bof\b/],
		function: () => {},
		type: "relational"
	}
};

class Box {
	constructor() {
		this.top = 0;
		this.right = 0;
		this.bottom = 0;
		this.left = 0;
	}

	draw(context, scale, xOffset = 0, yOffset = 0) {
		const objectColor = getComputedStyle(document.body).getPropertyValue('--object-color');
		context.strokeStyle = objectColor;
		context.fillStyle = objectColor + "80";
		context.rect(
			xOffset + scale * this.left,
			yOffset + scale * this.top,
			scale * (1 - this.left - this.right),
			scale * (1 - this.top - this.bottom)
		);
		context.stroke();
		context.fill();
	}
}

class DescriptionState {
	constructor() {
		this.state = "";
		this.adjective = "";
		this.box = null;
		this.steps = [];
	}

	zoomBox(part, adjective) {
		if (!this.box)
			this.box = new Box();
		switch (part) {
			case "quarter":
				switch (adjective) {
					case "north-east":
						this.box.bottom +=  (1 - this.box.top - this.box.bottom) / 2;
						this.box.left += (1 - this.box.left - this.box.right) / 2;
						break;
					case "north-west":
						this.box.bottom +=  (1 - this.box.top - this.box.bottom) / 2;
						this.box.right += (1 - this.box.left - this.box.right) / 2;
						break;
					case "south-east":
						this.box.top +=  (1 - this.box.top - this.box.bottom) / 2;
						this.box.left += (1 - this.box.left - this.box.right) / 2;
						break;
					case "south-west":
						this.box.top +=  (1 - this.box.top - this.box.bottom) / 2;
						this.box.right += (1 - this.box.left - this.box.right) / 2;
						break;
					default:
						throw new Error("Invalid quarter—" + (adjective ? adjective + " is not a valid quarter." : "no direction given."));
				}
				break;
			case "half":
				switch (adjective) {
					case "north":
						this.box.bottom +=  (1 - this.box.top - this.box.bottom) / 2;
						break;
					case "south":
						this.box.top +=  (1 - this.box.top - this.box.bottom) / 2;
						break;
					case "east":
						this.box.left += (1 - this.box.left - this.box.right) / 2;
						break;
					case "west":
						this.box.right += (1 - this.box.left - this.box.right) / 2;
						break;
					default:
						throw new Error("Invalid half—" + (adjective ? adjective + " is not a valid half." : "no direction given."));
				}
				break;
			default:
				throw new Error("Invalid part: " + part);
		}
	}
}
let state = new DescriptionState();

function updateMap() {
	legalDescriptionError.style.display = "none";
	let legalDescription = legalDescriptionBox.value;
	mapContext.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
	mapCanvas.setAttribute('width', window.getComputedStyle(mapCanvas, null).getPropertyValue("width"));

	if (legalDescription.length > 0) {
		state = new DescriptionState();
		legalDescription = legalDescription.replace(/[,.]/g, "");
		const words = legalDescription.split(" ");
		let wordBuffer = "";
		let instructionBuffer = [[]];
		try {
			/* Parse words to instructions */
			for (let i = 0; i < words.length; i++) {
				const word = words[i];
				wordBuffer += word + " ";
				const instruction = Object.keys(instructions).find(x =>
					instructions[x].matchWords.some(matchWord =>
						wordBuffer.match(new RegExp(matchWord, 'i'))
					)
				);
				if (instruction) {
					console.log("Found instruction: " + instruction);
					wordBuffer = "";
					if (instructions[instruction].type === "relational") {
						instructionBuffer.push([instruction], []);
					}
					else {
						instructionBuffer[instructionBuffer.length - 1].push(instruction);
					}
				}
			}

			/* Interpret instructions */
			for (let i = instructionBuffer.length - 1; i >= 0; i--) {
				instructionBuffer[i].forEach(instruction => instructions[instruction].function());
			}

			/* Draw map */
			const scale = 350;
			const xOffset = (mapCanvas.width - scale) / 2;
			const yOffset = 25;
			if (state.box) {
				mapContext.strokeStyle = "gray";
				mapContext.strokeRect(
					xOffset,
					yOffset,
					scale,
					scale
				);
				if (!state.steps.length)
					state.box.draw(mapContext, scale, xOffset, yOffset);
			}
			state.steps.forEach(x => x[0].apply(null, x[1]));
		} catch (e) {
			legalDescriptionError.style.display = "block";
			legalDescriptionError.innerHTML = "Error: " + e.message;
			console.log(e);
		}
	}
}
legalDescriptionBox.addEventListener("input", updateMap);
updateMap();
