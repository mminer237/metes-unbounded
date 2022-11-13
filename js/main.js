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
		matchWords: [/quarter/, /1\/4/, /¼/],
		function: () => {
			state.currentTract.zoomBox("quarter", state.adjective);
			state.status = "begin";
			state.adjective = "";
		},
		type: "part"
	},
	"half": {
		matchWords: [/half/, /1\/2/, /½/],
		function: () => {
			state.currentTract.zoomBox("half", state.adjective);
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
		function: () => {
			if (state.adjective === "north" || state.adjective === "south")
				state.adjective += "-east"
			else
				state.adjective = "east";
		},
		type: "adjective"
	},
	"west": {
		matchWords: [/west/, /westerly/, /w/, /westward/, /westwards/],
		function: () => {
			if (state.adjective === "north" || state.adjective === "south")
				state.adjective += "-west"
			else
				state.adjective = "west";
		},
		type: "adjective"
	},
	"north-east": {
		matchWords: [/north-east/, /northeast/, /north-easterly/, /ne/],
		function: () => { state.adjective = "north-east"; },
		type: "adjective"
	},
	"north-west": {
		matchWords: [/north-west/, /northwest/, /northwesterly/, /nw/],
		function: () => { state.adjective = "north-west"; },
		type: "adjective"
	},
	"south-east": {
		matchWords: [/south-east/, /southeast/, /southeasterly/, /se/],
		function: () => { state.adjective = "south-east"; },
		type: "adjective"
	},
	"south-west": {
		matchWords: [/south-west/, /southwest/, /southwesterly/, /sw/],
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
	"thereof": {
		matchWords: [/thereof/],
		function: () => {},
		type: "relational"
	},
	"except": {
		matchWords: [/except(ing)?/],
		function: () => {}
	},
	"include": {
		matchWords: [/includ(e|ing)?/],
		function: () => {}
	},
};

class Box {
	constructor(tract) {
		this.tract = tract;
		this.top = 0;
		this.right = 0;
		this.bottom = 0;
		this.left = 0;
	}

	draw(context, scale, xOffset = 0, yOffset = 0) {
		const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color');
		const exceptColor = getComputedStyle(document.body).getPropertyValue('--except-color');
		context.strokeStyle = this.tract.excepting ? exceptColor : accentColor;
		context.fillStyle = (this.tract.excepting ? exceptColor : accentColor) + "80";
		context.beginPath();
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

class Tract {
	constructor() {
		this.box = null;
		this.instructionBuffer = [[]];
		this.instructionBufferIndex = 0;
		this.steps = [];
		this.excepting = false;
	}

	zoomBox(part, adjective) {
		if (!this.box)
			this.box = new Box(this);
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

class DescriptionState {
	constructor() {
		this.state = "";
		this.adjective = "";
		this.section = "";
		this.township = "";
		this.range = "";
		this.pm = "";
		this.sectionScaleFeet = null;
		this.tracts = [new Tract()];
		this.currentTract = this.tracts[0];
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
						match = wordBuffer.match(new RegExp(String.raw`(?:^|\s|\b)(${matchWord.source})(?:$|\s|\b)`, 'iu'))
					)
				);
				if (match)
					match.shift();
				if (instruction) {
					console.log("Found instruction: " + instruction);
					wordBuffer = "";
					if (instructions[instruction].type === "relational") {
						if (instructions[state.currentTract.instructionBuffer[state.currentTract.instructionBufferIndex][state.currentTract.instructionBuffer[state.currentTract.instructionBufferIndex].length - 1]?.[0]]?.type === "part") {
							if (instruction === "thereof") {
								state.currentTract.instructionBuffer.splice(state.currentTract.instructionBufferIndex, 0, ...state.tracts[0].instructionBuffer);
								state.currentTract.instructionBufferIndex += state.tracts[0].instructionBuffer.length;
							}
							else {
								state.currentTract.instructionBuffer.splice(state.currentTract.instructionBufferIndex, 0, [], [[instruction, match]]);
							}
						}
					}
					else if (instruction === "except") {
						state.tracts.push(new Tract());
						state.currentTract = state.tracts[state.tracts.length - 1];
						state.currentTract.excepting = true;
						state.currentTract.instructionBuffer[state.currentTract.instructionBufferIndex].push([instruction, match]);
					}
					else if (instruction === "include") {
						state.tracts.push(new Tract());
						state.currentTract = state.tracts[state.tracts.length - 1];
						state.currentTract.instructionBuffer[state.currentTract.instructionBufferIndex].push([instruction, match]);
					}
					else if (instruction === "thence") {
						state.currentTract.instructionBufferIndex = state.currentTract.instructionBuffer.length - 1;
						state.currentTract.instructionBuffer[state.currentTract.instructionBufferIndex].push([instruction, match]);
					}
					else {
						state.currentTract.instructionBuffer[state.currentTract.instructionBufferIndex].push([instruction, match]);
					}
				}
			}
			console.log(state.tracts);

			/* Interpret instructions */
			for (let i = 0; i < state.tracts.length; i++) {
				state.currentTract = state.tracts[i];
				for (let j = 0; j < state.tracts[i].instructionBuffer.length; j++) {
					state.tracts[i].instructionBuffer[j].forEach(([instruction, match]) => {
						console.log("Executing instruction: " + instruction);
						return instructions[instruction].function(match);
					})
				}
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
			for (let i = 0; i < state.tracts.length; i++) {
				if (state.tracts[i].box) {
					mapContext.strokeStyle = "gray";
					mapContext.strokeRect(
						xOffset,
						yOffset,
						scale,
						scale
					);
					break;
				}
			}
			for (let i = 0; i < state.tracts.length; i++) {
				if (state.tracts[i].box) {
					if (!state.tracts[i].steps.length)
						state.tracts[i].box.draw(mapContext, scale, xOffset, yOffset);
				}
				state.tracts[i].steps.forEach(x => x[0].apply(null, x[1]));
			}
		} catch (e) {
			legalDescriptionError.style.display = "block";
			legalDescriptionError.innerHTML = "Error: " + e.message;
			console.log(e);
		}
	}
}
legalDescriptionBox.addEventListener("input", updateMap);
updateMap();
