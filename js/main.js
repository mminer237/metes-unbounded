"use strict"

const legalDescriptionBox = document.getElementById("legal-description");
const legalDescriptionError = document.getElementById("legal-description-error");
const surveyDivisionInfo = document.getElementById("survey-division-info");
const mapCanvas = document.getElementById("map-canvas");
const mapContext = mapCanvas.getContext("2d");

const instructions = {
	"begin": {
		matchWords: [/commencing/, /beginning (on|at)/],
		function: () => { state.status = "begin"; }
	},
	"section": {
		matchWords: [/section (\d+)/],
		function: match => {
			state.section = match[1];
			state.sectionScaleFeet = 5280;
			state.status = "begin";
		},
		type: "part"
	},
	"township": {
		matchWords: [/township (\d+) (n|s)[a-z]*( of the base line)?/],
		function: match => {
			state.township = `${match[1]} ${match[2].toUpperCase()}`;
			state.status = "begin";
		},
		type: "part"
	},
	"range": {
		matchWords: [/range (\d+) (e|w)[a-z]*/],
		function: match => {
			state.range = `${match[1]} ${match[2].toUpperCase()}`;
			state.status = "begin";
		},
		type: "part"
	},
	"pm": {
		matchWords: [/(\w+) (principal meridian|p\.m\.|pm)/],
		function: match => {
			state.pm = `${match[1]} Principal Meridian`;
			state.status = "begin";
		},
		type: "part"
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
	"north": {
		matchWords: [/north/, /northerly/, /n/, /northward/, /northwards/],
		function: () => { state.adjective = "north"; },
		type: "adjective"
	},
	"south": {
		matchWords: [/south/, /southerly/, /s/, /southward/, /southwards/],
		function: () => { state.adjective = "south"; },
		type: "adjective"
	},
	"east": {
		matchWords: [/east/, /easterly/, /e/, /eastward/, /eastwards/],
		function: () => { state.adjective = "east"; },
		type: "adjective"
	},
	"west": {
		matchWords: [/west/, /westerly/, /w/, /westward/, /westwards/],
		function: () => { state.adjective = "west"; },
		type: "adjective"
	},
	"north-east": {
		matchWords: [/north-east/, /north east/, /northeast/, /north-easterly/, /ne/],
		function: () => { state.adjective = "north-east"; },
		type: "adjective"
	},
	"north-west": {
		matchWords: [/north-west/, /north west/, /northwest/, /northwesterly/, /nw/],
		function: () => { state.adjective = "north-west"; },
		type: "adjective"
	},
	"south-east": {
		matchWords: [/south-east/, /south east/, /southeast/, /southeasterly/, /se/],
		function: () => { state.adjective = "south-east"; },
		type: "adjective"
	},
	"south-west": {
		matchWords: [/south-west/, /south west/, /southwest/, /southwesterly/, /sw/],
		function: () => { state.adjective = "south-west"; },
		type: "adjective"
	},
	"part of": {
		matchWords: [/part of/],
		function: () => {}
	},
	"of": {
		matchWords: [/of/],
		function: () => {},
		type: "relational"
	},
};

class Box {
	constructor() {
		this.top = 0;
		this.right = 0;
		this.bottom = 0;
		this.left = 0;
	}

	draw(context, scale, xOffset = 0, yOffset = 0) {
		const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color');
		context.strokeStyle = accentColor;
		context.fillStyle = accentColor + "80";
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
		this.section = "";
		this.township = "";
		this.range = "";
		this.pm = "";
		this.box = null;
		this.sectionScaleFeet = null;
		this.instructionBuffer = [[]];
		this.instructionBufferIndex = 0;
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
	const width =  window.getComputedStyle(mapCanvas, null).getPropertyValue("width");
	mapCanvas.setAttribute('width', width);
	if (width < 400)
		mapCanvas.setAttribute('height', width);

	if (legalDescription.length > 0) {
		state = new DescriptionState();
		legalDescription = legalDescription.replace(/[,.]/g, "");
		const words = legalDescription.split(" ");
		let wordBuffer = "";
		try {
			/* Parse words to instructions */
			for (let i = 0; i < words.length; i++) {
				const word = words[i];
				wordBuffer += word + " ";
				let match;
				const instruction = Object.keys(instructions).find(x =>
					instructions[x].matchWords.some(matchWord =>
						match = wordBuffer.match(new RegExp(String.raw`\b${matchWord.source}\b`, 'i'))
					)
				);
				if (instruction) {
					console.log("Found instruction: " + instruction);
					wordBuffer = "";
					if (instructions[instruction].type === "relational") {
						if (instructions[state.instructionBuffer[state.instructionBufferIndex][state.instructionBuffer[state.instructionBufferIndex].length - 1][0]].type === "part") {
							state.instructionBuffer.splice(state.instructionBufferIndex, 0, [], [[instruction, match]]);
						}
					}
					else if (instruction === "thence") {
						state.instructionBufferIndex = state.instructionBuffer.length - 1;
						state.instructionBuffer[state.instructionBufferIndex].push([instruction, match]);
					}
					else {
						state.instructionBuffer[state.instructionBufferIndex].push([instruction, match]);
					}
				}
			}

			/* Interpret instructions */
			for (let i = 0; i < state.instructionBuffer.length; i++) {
				state.instructionBuffer[i].forEach(([instruction, match]) => instructions[instruction].function(match));
			}

			/* Add survey division info */
			surveyDivisionInfo.innerText = [
				state.section ? `Section ${state.section}` : "",
				state.township ? `Township ${state.township}` : "",
				state.range ? `Range ${state.range}` : "",
				state.pm,
			].filter(x => x).join(", ");
			if (surveyDivisionInfo.innerText)
				surveyDivisionInfo.style.display = "block";
			else
				surveyDivisionInfo.style.display = "none";

			/* Draw map */
			const scale = Math.min(380, mapCanvas.width);
			const xOffset = (mapCanvas.width - scale) / 2;
			const yOffset = 10;
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
