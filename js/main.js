"use strict"

const legalDescriptionBox = $("#legal-description");
const legalDescriptionError = document.getElementById("legal-description-error");
const surveyDivisionInfo = document.getElementById("survey-division-info");
const mapCanvas = document.getElementById("map-canvas");
const mapContext = mapCanvas.getContext("2d");
document.documentElement.style.overflowY = "scroll";
document.documentElement.style.setProperty('--scrollbar-width', (window.innerWidth - document.documentElement.offsetWidth) + 'px');
document.documentElement.style.removeProperty('overflow-y');

function titleCase(str) {
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

const instructions = {
	"end": {
		matchWords: [/to the (true )?point of beginning/],
		function: () => {
			state.status = ""; 
			mapContext.fill();
		}
	},
	"begin": {
		matchWords: [/commencing/, /beginning (on|at)/],
		function: () => { state.status = "beginning"; }
	},
	"section": {
		matchWords: [/section (\d+)/],
		function: match => {
			state.section = match[1];
			state.sectionScaleFeet = 5280;
		},
		type: "part"
	},
	"township": {
		matchWords: [/township (\d+) (n|s)[a-z]*( of the base line)?/],
		function: match => {
			state.township = `${match[1]} ${match[2].toUpperCase()}`;
		},
		type: "part"
	},
	"range": {
		matchWords: [/range (\d+) (e|w)[a-z]*/],
		function: match => {
			state.range = `${match[1]} ${match[2].toUpperCase()}`;
		},
		type: "part"
	},
	"pm": {
		matchWords: [/(\w+) (principal meridian|p\.m\.|pm)/],
		function: match => {
			state.pm = `${titleCase(match[1])} Principal Meridian`;
		},
		type: "part"
	},
	"corner": {
		matchWords: [/corner/],
		function: () => {
			if (!state.direction)
				throw new Error("Invalid corner—no direction given.");
			let x, y;
			switch (state.direction) {
				case "north-east":
					y = 0 + (state.currentTract.box?.top ?? 0);
					x =	1 - (state.currentTract.box?.right ?? 0);
					break;
				case "north-west":
					y = 0 + (state.currentTract.box?.top ?? 0);
					x =	0 + (state.currentTract.box?.left ?? 0);
					break;
				case "south-east":
					y = 1 - (state.currentTract.box?.bottom ?? 0);
					x =	1 - (state.currentTract.box?.right ?? 0);
					break;
				case "south-west":
					y = 1 - (state.currentTract.box?.bottom ?? 0);
					x =	0 + (state.currentTract.box?.left ?? 0);
					break;
				default:
					throw new Error("Invalid corner—" + direction);
			}
			state.currentTract.steps.push([()=>{ state.moveTo(...state.translatePoint(x, y)); }, []]);
		},
		type: "point"
	},
	"point": {
		matchWords: [/point/],
		function: () => {},
		type: "point"
	},
	"iron rod": {
		matchWords: [/iron (rod|pipe|pin)( monument)?/],
		function: () => {
			state.currentTract.steps.push([()=>{
				mapContext.fillStyle = "#a19d94";
				mapContext.beginPath();
				mapContext.arc(
					state.cursorLocation.x,
					state.cursorLocation.y,
					2,
					0,
					2 * Math.PI
				);
				console.log(`Drawing iron rod at ${state.cursorLocation.x}, ${state.cursorLocation.y}`);
				mapContext.fill();
				setStatusStyle();
			}, []]);
		},
		type: "point"
	},
	"stone": {
		matchWords: [/stone(( survey)? monument)?/],
		function: () => {
			state.currentTract.steps.push([()=>{
				mapContext.fillStyle = "#a1a1a4";
				mapContext.beginPath();
				mapContext.arc(
					state.cursorLocation.x,
					state.cursorLocation.y,
					2,
					0,
					2 * Math.PI
				);
				console.log(`Drawing stone at ${state.cursorLocation.x}, ${state.cursorLocation.y}`);
				mapContext.fill();
				setStatusStyle();
			}, []]);
		},
		type: "point"
	},
	"quarter": {
		matchWords: [/quarter/, /1\/4/, /¼/],
		function: () => {
			state.currentTract.zoomBox("quarter", state.direction);
			state.direction = "";
		},
		type: "part"
	},
	"half": {
		matchWords: [/half/, /1\/2/, /½/],
		function: () => {
			state.currentTract.zoomBox("half", state.direction);
			state.direction = "";
		},
		type: "part"
	},
	"degrees": {
		matchWords: [/(\d+\.?\d*) ?(°|d\w* ) ?(?:(\d+\.?\d*) ?('|′|m\w* ))? ?(?:(\d+\.?\d*) ?("|″|s\w* ))? ?(N|S|E|W)\w*/],
		function: match => {
			const direction = `${state.direction} ${match[1]}°${match[3] ? `${match[3]}′` : ""}${match[5] ? `${match[5]}″` : ""} ${match[7].toUpperCase()}`;
			state.direction = direction;
			if (state.distance)
				queueLine();
		}
	},
	"north": {
		matchWords: [/north/, /northerly/, /n/, /northward/, /northwards/],
		function: () => {
			state.direction = "north";
			if (state.distance)
				queueLine();
		},
		type: "direction"
	},
	"south": {
		matchWords: [/south/, /southerly/, /(^| )s/, /southward/, /southwards/],
		function: () => {
			state.direction = "south";
			if (state.distance)
				queueLine();
		},
		type: "direction"
	},
	"east": {
		matchWords: [/east/, /easterly/, /e/, /eastward/, /eastwards/],
		function: () => {
			if (state.direction === "north" || state.direction === "south")
				state.direction += "-east"
			else {
				state.direction = "east";
				if (state.distance)
					queueLine();
			}
		},
		type: "direction"
	},
	"west": {
		matchWords: [/west/, /westerly/, /w/, /westward/, /westwards/],
		function: () => {
			if (state.direction === "north" || state.direction === "south")
				state.direction += "-west"
			else {
				state.direction = "west";
				if (state.distance)
					queueLine();
			}
		},
		type: "direction"
	},
	"north-east": {
		matchWords: [/north-east/, /northeast/, /north-easterly/, /ne/],
		function: () => { state.direction = "north-east"; },
		type: "direction"
	},
	"north-west": {
		matchWords: [/north-west/, /northwest/, /northwesterly/, /nw/],
		function: () => { state.direction = "north-west"; },
		type: "direction"
	},
	"south-east": {
		matchWords: [/south-east/, /southeast/, /southeasterly/, /se/],
		function: () => { state.direction = "south-east"; },
		type: "direction"
	},
	"south-west": {
		matchWords: [/south-west/, /southwest/, /southwesterly/, /sw/],
		function: () => { state.direction = "south-west"; },
		type: "direction"
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
	"at": {
		matchWords: [/at/],
		function: () => {},
		type: "relational"
	},
	"on": {
		matchWords: [/(up)?on/],
		function: () => {},
		type: "relational"
	},
	"thereof": {
		matchWords: [/thereof/],
		function: () => {},
		type: "relational"
	},
	"except": {
		matchWords: [/(also )?except(ing)?/],
		function: () => {}
	},
	"include": {
		matchWords: [/^and/, /also/, /includ(e|ing)?/],
		function: () => {}
	},
	"thence": {
		matchWords: [/thence/],
		function: () => {}
	},
	"feet": {
		matchWords: [/(\d+\.?\d*) (feet|foot|ft)/],
		function: match => {
			state.distance = new Distance(parseFloat(match[1]));
			if (state.direction)
				queueLine();
		}
	},
	"inches": {
		matchWords: [/(\d+\.?\d*) (inch(es)?|in)/],
		function: match => {
			if (!state.distance)
				state.distance = new Distance(parseFloat(match[1]) / 12);
			else
				state.distance.addFeet(parseFloat(match[1]) / 12);
			if (state.direction)
				queueLine();
		}
	},
	"chains": {
		matchWords: [/(\d+\.?\d*) (chain|ch)s?/],
		function: match => {
			state.distance = new Distance(parseFloat(match[1]) * 66);
			if (state.direction)
				queueLine();
		}
	},
	"links": {
		matchWords: [/(\d+\.?\d*) (link|li|l)s?/],
		function: match => {
			if (!state.distance)
				state.distance = new Distance(parseFloat(match[1]) * 0.66);
			else
				state.distance.addFeet(parseFloat(match[1]) * 0.66);
			if (state.direction)
				queueLine();
		}
	},
	"rods": {
		matchWords: [/(\d+\.?\d*) (rod|r)s?/],
		function: match => {
			state.distance = new Distance(parseFloat(match[1]) * 16.5);
			if (state.direction)
				queueLine();
		}
	},
	"meters": {
		matchWords: [/(\d+\.?\d*) (meter|metre|m)s?/],
		function: match => {
			state.distance = new Distance(parseFloat(match[1]) * 3.28084);
			if (state.direction)
				queueLine();
		}
	},
};

function queueLine() {
	const initialize = state.status !== "drawing";
	const distance = state.distance.clone();
	const direction = state.direction;
	state.currentTract.steps.push([() => {
		drawLine(initialize, distance, direction);
	}, []]);
	state.status = "drawing";
	state.distance = null;
	state.direction = "";
}

function directionToRadians(direction) {
	const directionParts = direction.split(" ");
	let radians = cardinalDirectionToRadians(directionParts[0]);

	const matches = directionParts[1]?.match(/(\d+\.?\d*)°(?:(\d+\.?\d*)′)?(?:(\d+\.?\d*)″)?/u);
	if (matches && directionParts[2]) {
		const secondDirection = cardinalDirectionToRadians(directionParts[2]);
		const angleDifference = secondDirection - radians;
		if (angleDifference == 0)
			throw new Error(`${directionParts[0].charAt(0).toUpperCase() + directionParts[0].slice(1)} can't be modified by parallel direction ${directionParts[2]}`);
		const right = angleDifference === -Math.PI / 2;

		let angle = parseInt(matches[1]);
		if (matches[2])
			angle += parseInt(matches[2]) / 60;
		if (matches[3])
			angle += parseInt(matches[3]) / 3600;
		radians += angle * Math.PI / 180 * (right ? -1 : 1);
	}

	return radians;
}

function cardinalDirectionToRadians(direction) {
	switch (direction) {
		case "north":
		case "N":
			return Math.PI;
		case "north-east":
			return Math.PI * 3 / 4;
		case "east":
		case "E":
			return Math.PI / 2;
		case "south-east":
			return Math.PI / 4;
		case "south":
		case "S":
			return 0;
		case "south-west":
			return -Math.PI / 4;
		case "west":
		case "W":
			return -Math.PI / 2;
		case "north-west":
			return -Math.PI * 3 / 4;
		default:
			throw new Error("Invalid direction: " + direction[0]);
	}
}

function drawLine(initialize, distance, direction) {
	if (initialize) {
		setStatusStyle();
		mapContext.beginPath();
		state.moveTo();
	}
	const currentPoint = state.cursorLocation;
	state.lineTo(
		currentPoint.x + distance.getPixels(state) * Math.sin(directionToRadians(direction)),
		currentPoint.y + distance.getPixels(state) * Math.cos(directionToRadians(direction))
	);
}

function setStatusStyle() {
	const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color');
	const exceptColor = getComputedStyle(document.body).getPropertyValue('--except-color');
	mapContext.strokeStyle = state.currentTract.excepting ? exceptColor : accentColor;
	mapContext.fillStyle = (state.currentTract.excepting ? exceptColor : accentColor) + "A0";
}

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
		console.log(`Drawing box from ${xOffset + scale * this.left}, ${yOffset + scale * this.top} to ${xOffset + scale * this.left + scale * (1 - this.left - this.right)}, ${yOffset + scale * this.top + scale * (1 - this.top - this.bottom)}`);
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

	zoomBox(part, direction) {
		if (!this.box)
			this.box = new Box(this);
		switch (part) {
			case "quarter":
				switch (direction) {
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
						throw new Error("Invalid quarter—" + (direction ? direction + " is not a valid quarter." : "no direction given."));
				}
				break;
			case "half":
				switch (direction) {
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
						throw new Error("Invalid half—" + (direction ? direction + " is not a valid half." : "no direction given."));
				}
				break;
			default:
				throw new Error("Invalid part: " + part);
		}
	}
}

class Distance {
	constructor(feet = 0) {
		this.feet = feet;
	}

	addFeet(feet) {
		this.feet += feet;
	}

	clone() {
		return new Distance(this.feet);
	}

	getFeet() {
		return this.feet;
	}

	getPixels(state) {
		return this.feet / state.sectionScaleFeet * state.scale;
	}
}

class DescriptionState {
	constructor() {
		this.state = "";
		/**
		 * Direction to draw next line
		 * @type {string}
		 */
		this.direction = "";
		/**
		 * Distance to draw next line in pixels
		 * @type {Distance?}
		 */
		this.distance = null;
		/**
		 * Current cursor location in pixels
		 * @type {{x: number?, y: number?}}
		 */
		this.cursorLocation = {x: null, y: null};
		this.section = "";
		this.township = "";
		this.range = "";
		this.pm = "";
		/**
		 * Width of the canvas in feet
		 * @type {number?}
		 */
		this.sectionScaleFeet = 5280; // Assume 1 section scale
		/**
		 * Width of the canvas in pixels
		 * @type {number?}
		 */
		this.scale = null; 
		this.xOffset = null;
		this.yOffset = null;
		this.tracts = [new Tract()];
		this.currentTract = this.tracts[0];
	}

	moveTo(x = this.cursorLocation.x, y = this.cursorLocation.y) {
		mapContext.moveTo(x, y);
		this.cursorLocation.x = x;
		this.cursorLocation.y = y;
		console.log(`Moving to ${x}, ${y}`);
	}

	lineTo(x = this.cursorLocation.x, y = this.cursorLocation.y) {
		mapContext.lineTo(x, y);
		this.cursorLocation.x = x;
		this.cursorLocation.y = y;
		console.log(`Planning line to ${x}, ${y}`);
	}

	/**
	 * Converts a ratio of widths to absolute pixel coordinates
	 * E.g., (0.5, 0.5) → [334, 200]
	 * @param {number} x 
	 * @param {number} y 
	 * @returns {[number, number]}
	 */
	translatePoint(x, y) {
		return [
			this.xOffset + this.scale * x,
			this.yOffset + this.scale * y
		];
	}
}
let state = new DescriptionState();
let highlightRanges = [];
const getHighlightRanges = () => highlightRanges;

function updateMap() {
	legalDescriptionError.style.display = "none";
	const rawLegalDescription = legalDescriptionBox.val();
	let legalDescription = rawLegalDescription;
	mapContext.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
	const width =  window.getComputedStyle(mapCanvas, null).getPropertyValue("width");
	mapCanvas.setAttribute('width', width);
	if (width < 400)
		mapCanvas.setAttribute('height', width);

	if (legalDescription.length > 0) {
		state = new DescriptionState();
		/* Remove unneeded punctuation */
		legalDescription = legalDescription.replace(/[,;]|(?<!\d)[."]/g, "");
		/* Remove parentheticals */
		legalDescription = legalDescription.replace(/\(.*?\)/g, "");
		/* Convert non-breaking spaces to regular spaces */
		legalDescription = legalDescription.replace(/\u00A0/g, " ");
		const words = legalDescription.split(/\s+|(?<=[\p{L}\p{M}])(?=\d|½|¼)/u);
		let wordBuffer = "";
		highlightRanges = [];
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

				if (match) {
					/* Set to highlight the matched word */
					const matchBreaks = (match[0].trim().match(/\s+/g)?.length ?? 0);
					console.log(match[0].trim().split(/\s+/g));
					let boxBreaks = 0;
					let startingIndex = 0;
					let endingIndex = 0;
					let parenthetical = false;
					let lastWasLetter = false;
					let lastWasSpace = false;
					// TODO: Fix to include first word if it's a match
					for (; endingIndex < rawLegalDescription.length; endingIndex++) {
						if (rawLegalDescription[endingIndex] === "(") {
							parenthetical = true;
						}
						else if (rawLegalDescription[endingIndex] === ")") {
							parenthetical = false;
							if (startingIndex === endingIndex) {
								startingIndex++;
							}
						}
						if (parenthetical && startingIndex === endingIndex) {
							startingIndex++;
						}
						if (!parenthetical) {
							if (rawLegalDescription[endingIndex].match(/[\p{L}\p{M}]/u)) {
								lastWasLetter = true;
								lastWasSpace = false;
							}
							else if (rawLegalDescription[endingIndex].match(/\d|½|¼/)) {
								if (lastWasLetter) {
									boxBreaks++;
									if (boxBreaks === i - matchBreaks) {
										startingIndex = endingIndex;
									}
									else if (startingIndex && boxBreaks === i + 1)
										break;
									lastWasLetter = false;
								}
								lastWasSpace = false;
							}
							else if (rawLegalDescription[endingIndex] === " ") {
								if (!lastWasSpace) {
									boxBreaks++;
									if (boxBreaks === i - matchBreaks) {
										startingIndex = endingIndex + 1;
									}
									else if (startingIndex && boxBreaks === i + 1)
										break;
									lastWasSpace = true;
								}
								else {
									if (startingIndex)
										startingIndex++;
								}
								lastWasLetter = false;
							}
							else {
								lastWasLetter = false;
							}
						}
					}
					if (startingIndex)
						highlightRanges.push([startingIndex, endingIndex]);

					/* Remove the matched phrase, leaving only the capture groups */
					match.shift();
				}

				if (instruction) {
					console.log("Found instruction: " + instruction);
					wordBuffer = "";
					if (instructions[instruction].type === "relational") {
						if (
							instructions[state.currentTract.instructionBuffer[state.currentTract.instructionBufferIndex][state.currentTract.instructionBuffer[state.currentTract.instructionBufferIndex].length - 1]?.[0]]?.type === "part" ||
							instructions[state.currentTract.instructionBuffer[state.currentTract.instructionBufferIndex][state.currentTract.instructionBuffer[state.currentTract.instructionBufferIndex].length - 1]?.[0]]?.type === "point"
						) {
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
			legalDescriptionBox.highlightWithinTextarea('update');
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
			state.scale = Math.min(380, mapCanvas.width);
			state.xOffset = (mapCanvas.width - state.scale) / 2;
			state.yOffset = 10;
			for (let i = 0; i < state.tracts.length; i++) {
				if (state.tracts[i].box) {
					mapContext.strokeStyle = "gray";
					mapContext.strokeRect(
						state.xOffset,
						state.yOffset,
						state.scale,
						state.scale
					);
					console.log(`Drawing gray box from ${state.xOffset}, ${state.yOffset} to ${state.xOffset + state.scale}, ${state.yOffset + state.scale}`);
					break;
				}
			}
			for (let i = 0; i < state.tracts.length; i++) {
				state.currentTract = state.tracts[i];
				if (state.tracts[i].box) {
					if (!state.tracts[i].steps.length)
						state.tracts[i].box.draw(mapContext, state.scale, state.xOffset, state.yOffset);
				}
				state.tracts[i].steps.forEach(x => x[0].apply(null, x[1]));
				mapContext.stroke();
				// TODO: Only fill if ending and starting point the same
				mapContext.fill();
				console.log("Drawing lines");
			}
		} catch (e) {
			legalDescriptionError.style.display = "block";
			legalDescriptionError.innerHTML = "Error: " + e.message;
			console.log(e);
		}
	}
}
legalDescriptionBox.on("input", updateMap);
legalDescriptionBox.highlightWithinTextarea({
	highlight: getHighlightRanges
});
const hwtContainer = document.getElementsByClassName("hwt-container")[0];
new ResizeObserver(() => {
	hwtContainer.style.width = legalDescriptionBox[0].offsetWidth + 28 + "px";
	hwtContainer.style.height = legalDescriptionBox[0].offsetHeight + 20 + "px";
}).observe(legalDescriptionBox[0]);
updateMap();
