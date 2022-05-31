"use strict"

const legalDescriptionBox = document.getElementById("legal-description");
const legalDescriptionError = document.getElementById("legal-description-error");
const mapCanvas = document.getElementById("map-canvas");
const mapContext = mapCanvas.getContext("2d");

const instructions = {
	"begin": {
		matchWords: [/commencing/, /beginning (on|at)/],
		function: () => { state.status = "begin"; }
	},
	"north": {
		matchWords: [/north\b/, /northerly/, /\bn\b/, /northward/, /northwards/],
		function: () => { state.adjective = "north"; }
	},
	"south": {
		matchWords: [/south\b/, /southerly/, /\bs\b/, /southward/, /southwards/],
		function: () => { state.adjective = "south"; }
	},
	"east": {
		matchWords: [/east\b/, /easterly/, /\b\b/, /eastward/, /eastwards/],
		function: () => { state.adjective = "east"; }
	},
	"west": {
		matchWords: [/west\b/, /westerly/, /\bw\b/, /westward/, /westwards/],
		function: () => { state.adjective = "west"; }
	},
	"north-east": {
		matchWords: [/north-east\b/, /north east/, /northeast/ /north-easterly/, /\bne\b/],
		function: () => { state.adjective = "north-east"; }
	},
	"north-west": {
		matchWords: [/north-west\b/, /north west/, /northwest/, /northwesterly/, /\bnw\b/],
		function: () => { state.adjective = "north-west"; }
	},
	"south-east": {
		matchWords: [/south-east\b/, /south east/, /southeast/, /southeasterly/, /\bse\b/],
		function: () => { state.adjective = "south-east"; }
	},
	"south-west": {
		matchWords: [/south-west\b/, /south west/, /southwest/, /southwesterly/, /\bsw\b/],
		function: () => { state.adjective = "south-west"; }
	},
	"corner": {
		matchWords: [/corner/],
		function: () => { state.status = "corner"; }
	},
	"quarter": {
		matchWords: [/quarter/],
		function: () => {
			state.zoomBox("quarter", state.adjective);
			state.status = "begin";
			state.adjective = "";
		}
	},
	"half": {
		matchWords: [/half/],
		function: () => {
			state.zoomBox("half", state.adjective);
			state.status = "begin";
			state.adjective = "";
		}
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
		context.strokeStyle = "gray";
		context.strokeRect(
			xOffset + scale * this.left,
			yOffset + scale * this.top,
			scale * (this.right - this.left),
			scale * (this.bottom - this.top)
		);
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
						this.box.bottom +=  (1 - this.box.top - this.bottom) / 2;
						this.box.left += (1 - this.box.left - this.right) / 2;
						break;
					case "north-west":
						this.box.bottom +=  (1 - this.box.top - this.bottom) / 2;
						this.box.right += (1 - this.box.left - this.right) / 2;
						break;
					case "south-east":
						this.box.top +=  (1 - this.box.top - this.bottom) / 2;
						this.box.left += (1 - this.box.left - this.right) / 2;
						break;
					case "south-west":
						this.box.top +=  (1 - this.box.top - this.bottom) / 2;
						this.box.right += (1 - this.box.left - this.right) / 2;
						break;
					default:
						throw new Error("Invalid quarter—" + adjective + " is not a valid quarter.");
				}
				break;
			case "half":
				switch (adjective) {
					case "north":
						this.box.bottom +=  (1 - this.box.top - this.bottom) / 2;
						break;
					case "south":
						this.box.top +=  (1 - this.box.top - this.bottom) / 2;
						break;
					case "east":
						this.box.left += (1 - this.box.left - this.right) / 2;
						break;
					case "west":
						this.box.right += (1 - this.box.left - this.right) / 2;
						break;
					default:
						throw new Error("Invalid half—" + adjective + " is not a valid half.");
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
	const legalDescription = legalDescriptionBox.value;
	mapContext.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

	if (legalDescription.length > 0) {
		/* Strip commas and periods from the legal description */
		legalDescription = legalDescription.replace(/[,.]/g, "");
		const words = legalDescription.split(" ");
		let wordBuffer = "";
		try {
			for (let i = 0; i < words.length; i++) {
				const word = words[i];
				wordBuffer += word + " ";
				const instruction = instructions.keys().find(x => instructions[x].some(y => wordBuffer.match(new RegExp(y, 'i'))));
				if (instruction) {
					wordBuffer = "";
					instructions[instruction].function();
				}
			}
			state.box?.draw(mapContext, 350, (mapCanvas.width - 350) / 2, 50);
			state.steps.forEach(x => x[0].apply(null, x[1]));
		} catch (e) {
			legalDescriptionError.style.display = "block";
			legalDescriptionError.innerHTML = "Error: " + e.message;
		}
	}
}
legalDescriptionBox.addEventListener("change", updateMap);
