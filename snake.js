/**
 * @author Dominik Dąbek
 */

const CANVAS_ID = 'mainCanvas';
const DEFAULT_MIN_SNAKE_LENGTH = 3;
const DEFAULT_FEED_GROW = 1;
const DEFAULT_BOARD_SIZE = 20;
const DEFAULT_SPEED = 10;

const MIN_SNAKE_LENGTH_GET_NAME = 'msl';
const FEED_GROW_GET_NAME = 'feed';
const BOARD_SIZE_GET_NAME = 'board';
const SPEED_GET_NAME = 'speed';

let gameSettings = new GameSettings();
let frameTime = Math.floor(1000 / gameSettings.gameSpeed);
console.log("frame time " + frameTime);
let gameStorage = new GameStorage();
let gameLogic = new GameLogic();
let gameRender = new GameRenderer();
let touchHandler = new TouchHandler();

document.addEventListener('keydown', gameLogic);
document.addEventListener('touchmove', touchHandler);
document.addEventListener('touchstart', function (event) {
    touchHandler.handleTouchStart(event);
});

function gameUpdate() {
    gameLogic.update();
    gameRender.drawFrame();
}

gameUpdate();

window.setInterval(gameUpdate, frameTime);

function GameSettings() {
    let urlParams = new URLSearchParams(window.location.search);
    this.minSnakeLength = DEFAULT_MIN_SNAKE_LENGTH;
    let minSnakeLength = getIntGetParameterFromUrlParams(MIN_SNAKE_LENGTH_GET_NAME, urlParams);
    if (minSnakeLength) {
        this.minSnakeLength = minSnakeLength;
    }

    this.feedGrow = DEFAULT_FEED_GROW;
    let feedGrow = getIntGetParameterFromUrlParams(FEED_GROW_GET_NAME, urlParams);
    if (feedGrow) {
        this.feedGrow = feedGrow;
    }

    this.boardSize = DEFAULT_BOARD_SIZE;
    let boardSize = getIntGetParameterFromUrlParams(BOARD_SIZE_GET_NAME, urlParams);
    if (boardSize) {
        this.boardSize = boardSize;
    }

    this.gameSpeed = DEFAULT_SPEED;
    let gameSpeed = getIntGetParameterFromUrlParams(SPEED_GET_NAME, urlParams);
    if (gameSpeed) {
        this.gameSpeed = gameSpeed;
    }


    function getIntGetParameterFromUrlParams(parameterName, urlParams) {
        if (urlParams.has(parameterName)) {
            let parameterValue = parseInt(urlParams.get(parameterName));
            if (Number.isInteger(parameterValue)) {
                return parameterValue;
            }
        }
        return null;
    }
}

function TouchHandler() {
    this.lastTouchX = 0;
    this.lastTouchY = 0;

    let movingAverageWindow = 5;
    this.diffsX = Array(movingAverageWindow).fill(0);
    this.diffsY = Array(movingAverageWindow).fill(0);


    this.minimumDifference = 5;
    this.handleEvent = function (event) {
        if (event.touches && event.touches.length > 0) {
            let touch = event.touches[0];
            let touchX = touch.clientX;
            let touchY = touch.clientY;
            let differenceX = this.lastTouchX - touchX;
            let differenceY = this.lastTouchY - touchY;
            if (Math.abs(differenceX) < this.minimumDifference && Math.abs(differenceY) < this.minimumDifference) {
                return;
            }
            this.lastTouchX = touchX;
            this.lastTouchY = touchY;
            this.diffsX.shift();
            this.diffsX.push(differenceX);
            this.diffsY.shift();
            this.diffsY.push(differenceY);
            let sumDiffsX = this.diffsX.reduce(function (a, b) {
                return a + b;
            });
            let sumDiffsY = this.diffsY.reduce(function (a, b) {
                return a + b;
            });
            // console.log("" + sumDiffsX + " , " + sumDiffsY);
            if (Math.abs(sumDiffsX) > Math.abs(sumDiffsY)) {
                if (differenceX > 0) {
                    gameLogic.handleControl("ArrowLeft");
                } else {
                    gameLogic.handleControl("ArrowRight");
                }
            } else {
                if (differenceY > 0) {
                    gameLogic.handleControl("ArrowUp");
                } else {
                    gameLogic.handleControl("ArrowDown");
                }
            }
        }
    };

    this.handleTouchStart = function (event) {
        this.diffsX = this.diffsX.fill(0);
        this.diffsY = this.diffsY.fill(0);
        let touch = event.touches[0];
        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;
    }
}

function GameLogic() {
    this.snakeActor = new SnakeActor(3, 3);
    this.meatActor = new MeatActor(1, 1);
    this.boardSizeInCells = gameSettings.boardSize;
    this.keyBuffer = null;
    this.highScore = gameStorage.loadHighScore();
    this.isHighScoreStreak = false;

    this.score = 0;

    this.clearKeyBuffer = function () {
        this.keyBuffer = null;
    };

    this.handleEvent = function (event) {
        this.handleControl(event.key);
    };

    this.handleControl = function (eventKey) {
        switch (eventKey) {
            case "ArrowDown":
                if (this.snakeActor.goDown()) {
                    this.clearKeyBuffer();
                } else {
                    this.keyBuffer = eventKey;
                }
                break;
            case "ArrowUp":
                if (this.snakeActor.goUp()) {
                    this.clearKeyBuffer();
                } else {
                    this.keyBuffer = eventKey;
                }
                break;
            case "ArrowLeft":
                if (this.snakeActor.goLeft()) {
                    this.clearKeyBuffer();
                } else {
                    this.keyBuffer = eventKey;
                }
                break;
            case "ArrowRight":
                if (this.snakeActor.goRight()) {
                    this.clearKeyBuffer();
                } else {
                    this.keyBuffer = eventKey;
                }
                break;
        }
    };

    this.update = function () {
        if (this.keyBuffer) {
            this.handleControl(this.keyBuffer);
        }
        this.snakeActor.move();
        //if on top of meat, grow snake, move meat
        if (isSamePosition(this.snakeActor, this.meatActor)) {
            this.snakeActor.feed();
            this.updateScore();
            let randomPosition = getRandomPosition(this.boardSizeInCells);
            this.meatActor.setPosition(randomPosition);
        }
        //if collided with tail, cut off from collision point
        let segments = this.snakeActor.segments;
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
            let segment = segments[segmentIndex];
            if (isSamePosition(this.snakeActor, segment)) {
                this.snakeActor.snakeLength = Math.max(gameSettings.minSnakeLength, segmentIndex - 1);
                this.snakeActor.segments = segments.slice(0, this.snakeActor.snakeLength);
                this.updateScore();
                break;
            }
        }
        //wrap walls
        if (this.snakeActor.x < 0) {
            this.snakeActor.x = this.boardSizeInCells - 1;
        } else if (this.snakeActor.x >= this.boardSizeInCells) {
            this.snakeActor.x = 0;
        }
        if (this.snakeActor.y < 0) {
            this.snakeActor.y = this.boardSizeInCells - 1;
        } else if (this.snakeActor.y >= this.boardSizeInCells) {
            this.snakeActor.y = 0;
        }
    };

    this.updateScore = function () {
        this.score = this.snakeActor.snakeLength - gameSettings.minSnakeLength;
        if (this.score > this.highScore) {
            console.log("new highscore!");
            this.highScore = this.score;
            gameStorage.storeHighScore(this.score);
            this.isHighScoreStreak = true;
        } else {
            this.isHighScoreStreak = false;
        }
    };

    function isSamePosition(actor1, actor2) {
        return actor1.x === actor2.x && actor1.y === actor2.y;
    }

    function getRandomPosition(stopX, stopY) {
        if (stopY === undefined) {
            stopY = stopX;
        }
        let x = Math.floor(Math.random() * stopX);
        let y = Math.floor(Math.random() * stopY);
        return {'x': x, 'y': y};
    }

}

function GameRenderer() {
    this.canvasElement = document.getElementById(CANVAS_ID);
    this.renderContext = this.canvasElement.getContext('2d');
    let size = Math.min(window.innerWidth, window.innerHeight);
    this.renderContext.canvas.width = size;
    this.renderContext.canvas.height = size;
    this.canvasWidth = this.canvasElement.getAttribute('width');
    this.canvasHeight = this.canvasElement.getAttribute('height');

    this.borderThickness = 5;
    this.borderColor = '#060';

    this.backgroundColor = '#000';

    this.scoreColor = 'rgba(255,255,255,0.5)';
    this.scoreFont = Math.floor(this.canvasWidth / 4) + 'px Sans-Serif';

    this.highScoreColor = 'rgba(255,252,24,0.72)';
    this.highScoreFont = Math.floor(this.canvasWidth / 3) + 'px Sans-Serif';

    this.textOpacity = 1.0;
    this.textColor = 'rgba(255,255,255,' + this.textOpacity + ')';
    // this.textSize = Math.floor(this.canvasWidth / 16);
    this.textSize = parseInt(getComputedStyle(document.documentElement).fontSize);
    // this.textFont = this.textSize + 'px Sans-Serif';
    this.textFont = '2rem Sans-Serif';
    this.gameSettingsTextDisplayTime = 5000;
    this.gameSettingsTextTimeLeft = this.gameSettingsTextDisplayTime;

    this.meatColor = '#900';

    this.snakeColor = '#0A0';


    let cellTableObject = makeCellTable(this, gameSettings.boardSize);
    this.cellSize = cellTableObject.cellSize;
    this.cellTable = cellTableObject.cellTable;
    this.snakeThickness = Math.floor(this.cellSize*0.75);

    this.drawFrame = function () {

        this.countDownTimers(frameTime);
        this.updateTextOpacity();

        clearFrame(this);

        drawBackground(this, this.backgroundColor);

        drawGameBorder(this);

        drawSnake(this, gameLogic.snakeActor);

        let meat = gameLogic.meatActor;
        drawMeat(this, meat.y, meat.x);

        if (gameLogic.isHighScoreStreak) {
            drawScore(this, this.highScoreColor, this.highScoreFont);
        } else {
            drawScore(this, this.scoreColor, this.scoreFont);
        }

        drawGameSettingsText(this, this.textColor, this.textFont);

        function clearFrame(gameRenderer) {
            let ctx = gameRenderer.renderContext;
            let width = gameRenderer.canvasWidth;
            let height = gameRenderer.canvasHeight;
            ctx.clearRect(0, 0, width, height);
        }

        function drawBackground(gameRenderer, color) {
            let ctx = gameRenderer.renderContext;
            ctx.fillStyle = color;
            let width = gameRenderer.canvasWidth;
            let height = gameRenderer.canvasHeight;
            ctx.fillRect(0, 0, width, height);
        }

        function drawGameBorder(gameRenderer) {
            let ctx = gameRenderer.renderContext;
            let width = gameRenderer.canvasWidth;
            let height = gameRenderer.canvasHeight;
            let borderThickness = gameRenderer.borderThickness;
            let startX = borderThickness / 2;
            let startY = borderThickness / 2;
            ctx.strokeStyle = gameRenderer.borderColor;
            ctx.lineWidth = borderThickness;
            ctx.strokeRect(startX, startY, width - borderThickness, height - borderThickness);
        }

        function drawSnake(gameRenderer, snakeActor) {
            //draw head
            drawSnakeSegment(gameRenderer, snakeActor.y, snakeActor.x);
            //draw tail
            let thickness = gameRenderer.snakeThickness;
            let snakeSegments = snakeActor.segments;
            let previousSegment = snakeActor;
            for (let segmentIndex = 0; segmentIndex < snakeSegments.length; segmentIndex++) {
                let segment = snakeSegments[segmentIndex];
                let changeX = segment.x - previousSegment.x;
                let changeY = segment.y - previousSegment.y;
                if (changeX === 1) {
                    drawSnakeSegmentThinLeft(gameRenderer,segment.y, segment.x, thickness);
                    drawSnakeSegmentThinRight(gameRenderer, previousSegment.y, previousSegment.x, thickness);
                } else if (changeX === -1) {
                    drawSnakeSegmentThinRight(gameRenderer,segment.y, segment.x, thickness);
                    drawSnakeSegmentThinLeft(gameRenderer, previousSegment.y, previousSegment.x, thickness);
                } else if (changeY === 1) {
                    drawSnakeSegmentThinUp(gameRenderer,segment.y, segment.x, thickness);
                    drawSnakeSegmentThinDown(gameRenderer, previousSegment.y, previousSegment.x, thickness);
                } else if (changeY === -1) {
                    drawSnakeSegmentThinDown(gameRenderer,segment.y, segment.x, thickness);
                    drawSnakeSegmentThinUp(gameRenderer, previousSegment.y, previousSegment.x, thickness);
                }
                previousSegment = segment;
                // drawSnakeSegment(gameRenderer, segment.y, segment.x);
            }
        }

        function drawSnakeSegment(gameRenderer, row, col) {
            drawFillCell(gameRenderer, row, col, gameRenderer.snakeColor);
        }

        function drawMeat(gameRenderer, row, col) {
            drawFillCell(gameRenderer, row, col, gameRenderer.meatColor);
        }

        function drawSnakeSegmentThinLeft(gameRenderer, row, col, thickness) {
            let ctx = gameRenderer.renderContext;
            let cellSize = gameRenderer.cellSize;
            let cell = gameRenderer.cellTable[row][col];
            ctx.fillStyle = gameRenderer.snakeColor;
            let padding = (cellSize - thickness) / 2;
            let x = cell.x;
            let y = cell.y + padding;
            let w = (cellSize + thickness) / 2;
            let h = thickness;
            ctx.fillRect(x, y, w, h);
        }

        function drawSnakeSegmentThinUp(gameRenderer, row, col, thickness) {
            let ctx = gameRenderer.renderContext;
            let cellSize = gameRenderer.cellSize;
            let cell = gameRenderer.cellTable[row][col];
            ctx.fillStyle = gameRenderer.snakeColor;
            let padding = (cellSize - thickness) / 2;
            let x = cell.x + padding;
            let y = cell.y;
            let w = thickness;
            let h = (cellSize + thickness) / 2;
            ctx.fillRect(x, y, w, h);
        }

        function drawSnakeSegmentThinRight(gameRenderer, row, col, thickness) {
            let ctx = gameRenderer.renderContext;
            let cellSize = gameRenderer.cellSize;
            let cell = gameRenderer.cellTable[row][col];
            ctx.fillStyle = gameRenderer.snakeColor;
            let padding = (cellSize - thickness) / 2;
            let x = cell.x + cellSize / 2 - thickness / 2;
            let y = cell.y + cellSize / 2 - thickness / 2;
            let w = (cellSize + thickness) / 2;
            let h = thickness;
            ctx.fillRect(x, y, w, h);
        }

        function drawSnakeSegmentThinDown(gameRenderer, row, col, thickness) {
            let ctx = gameRenderer.renderContext;
            let cellSize = gameRenderer.cellSize;
            let cell = gameRenderer.cellTable[row][col];
            ctx.fillStyle = gameRenderer.snakeColor;
            let padding = (cellSize - thickness) / 2;
            let x = cell.x + cellSize / 2 - thickness / 2;
            let y = cell.y + cellSize / 2 - thickness / 2;
            let w = thickness;
            let h = (cellSize + thickness) / 2;
            ctx.fillRect(x, y, w, h);
        }

        function drawFillCell(gameRenderer, row, col, color) {
            let ctx = gameRenderer.renderContext;
            let cellSize = gameRenderer.cellSize;
            let cell = gameRenderer.cellTable[row][col];
            ctx.fillStyle = color;
            ctx.fillRect(cell.x + 1, cell.y + 1, cellSize - 2, cellSize - 2);
        }

        function drawScore(gameRenderer, color, font) {
            let ctx = gameRenderer.renderContext;
            ctx.fillStyle = color;
            ctx.font = font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let x = Math.floor(gameRenderer.canvasWidth / 2);
            let y = Math.floor(gameRenderer.canvasHeight / 2);
            ctx.fillText(gameLogic.score, x, y, gameRenderer.canvasWidth / 2);
        }

        function drawGameSettingsText(gameRenderer, color, font) {
            let ctx = gameRenderer.renderContext;
            ctx.fillStyle = color;
            ctx.font = font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let x = Math.floor(gameRenderer.canvasWidth / 2);
            let y = Math.floor(2 * gameRenderer.textSize);
            printText("Speed " + gameSettings.gameSpeed, 0);
            printText("Board size " + gameSettings.boardSize, 1);
            printText("High score " + gameLogic.highScore, 2);

            function printText(text, row = 0) {
                ctx.fillText(text, x, y + 2 * row * gameRenderer.textSize, Math.floor(gameRenderer.canvasWidth));
            }
        }
    };

    this.countDownTimers = function (amount) {
        this.gameSettingsTextTimeLeft -= amount;
        if (this.gameSettingsTextTimeLeft < 0)
            this.gameSettingsTextTimeLeft = 0;
    };

    this.updateTextOpacity = function () {
        this.textOpacity = this.gameSettingsTextTimeLeft / this.gameSettingsTextDisplayTime;
        this.textColor = 'rgba(255,255,255,' + this.textOpacity + ')';
    };

    /**
     *
     * @param {GameRenderer} gameRenderer
     * @param {int} widthInCells
     */
    function makeCellTable(gameRenderer, widthInCells) {
        let canvasWidth = gameRenderer.canvasWidth;
        let canvasHeight = gameRenderer.canvasHeight;
        let borderThickness = gameRenderer.borderThickness;
        let usefulSize = canvasWidth - (2 * borderThickness);
        let cellSize = Math.floor(usefulSize / widthInCells);
        console.log("cell size " + cellSize);
        if (cellSize < 1) {
            throw "cell size would be less than 1 pixel!";
        }
        let remainder = usefulSize % widthInCells;
        let leftMargin = Math.floor(remainder / 2);
        let rightMargin = remainder - leftMargin;
        let startX = borderThickness + leftMargin;
        let startY = borderThickness + leftMargin;

        let cellTable = Array(widthInCells);
        for (let row = 0; row < widthInCells; row++) {
            cellTable[row] = Array(widthInCells);
            for (let col = 0; col < widthInCells; col++) {
                cellTable[row][col] = {
                    'x': startX + col * cellSize,
                    'y': startY + row * cellSize
                }
            }
        }
        return {
            'cellTable': cellTable,
            'cellSize': cellSize
        };
    }

}

function GameStorage() {
    this.storeHighScore = function (highScore) {
        if (typeof (Storage) !== "undefined") {
            // Code for localStorage/sessionStorage.
            let speed = gameSettings.gameSpeed;
            let boardSize = gameSettings.boardSize;
            let feedGrow = gameSettings.feedGrow;
            let minSnakeLength = gameSettings.minSnakeLength;
            let gameSettingsString = this.gameSettingsToString(speed, boardSize, feedGrow, minSnakeLength);
            localStorage.setItem(gameSettingsString, highScore.toString());
        } else {
            // Sorry! No Web Storage support..
        }
    };

    this.loadHighScore = function () {
        if (typeof (Storage) !== "undefined") {
            // Code for localStorage/sessionStorage.
            let speed = gameSettings.gameSpeed;
            let boardSize = gameSettings.boardSize;
            let feedGrow = gameSettings.feedGrow;
            let minSnakeLength = gameSettings.minSnakeLength;
            let gameSettingsString = this.gameSettingsToString(speed, boardSize, feedGrow, minSnakeLength);
            let highscore = localStorage.getItem(gameSettingsString);
            if (highscore) {
                return highscore;
            } else {
                return 0;
            }
        } else {
            // Sorry! No Web Storage support..
            return 0;
        }
    };

    this.gameSettingsToString = function (speed, boardSize, feedGrow, minSnakeLength) {
        return "S" + speed + "B" + boardSize + "F" + feedGrow + "M" + minSnakeLength;
    };

    this.stringToGameSettings = function (gameSettingsString) {
        let speedStartIndex = 1;
        let boardSizeStartIndex = gameSettingsString.search('B');
        let feedGrowStartIndex = gameSettingsString.search('F');
        let minSnakeLengthStartIndex = gameSettingsString.search('M');

        let speed = parseInt(gameSettingsString.substring(speedStartIndex, boardSizeStartIndex));
        let boardSize = parseInt(gameSettingsString.substring(boardSizeStartIndex, feedGrowStartIndex));
        let feedGrow = parseInt(gameSettingsString.substring(feedGrowStartIndex, minSnakeLengthStartIndex));
        let minSnakeLength = parseInt(gameSettingsString.substring(minSnakeLengthStartIndex));

        return {
            'speed': speed,
            'boardSize': boardSize,
            'feedGrow': feedGrow,
            'minSnakeLength': minSnakeLength
        }
    };
}

function GenericActor(startingX, startingY) {
    this.x = startingX;
    this.y = startingY;

    this.setPosition = function (position) {
        this.x = position.x;
        this.y = position.y;
    }
}

function MeatActor(startingX, startingY) {
    GenericActor.call(this, startingX, startingY);
}

function SnakeActor(startingX, startingY) {
    GenericActor.call(this, startingX, startingY);
    this.changeX = 0;
    this.changeY = 0;
    this.snakeLength = gameSettings.minSnakeLength;
    this.segments = Array();

    this.feed = function () {
        this.snakeLength += gameSettings.feedGrow;
    };

    this.move = function () {
        this.segments.unshift({
            'x': this.x,
            'y': this.y
        });
        if (this.segments.length > this.snakeLength - 1) {
            this.segments.pop();
        }
        this.x += this.changeX;
        this.y += this.changeY;
    };

    this.goRight = function () {
        if (this.getLastChangeX() !== -1) {
            this.changeY = 0;
            this.changeX = 1;
            return true;
        }
        return false;
    };

    this.goLeft = function () {
        if (this.getLastChangeX() !== 1) {
            this.changeY = 0;
            this.changeX = -1;
            return true;
        }
        return false
    };

    this.goUp = function () {
        if (this.getLastChangeY() !== 1) {
            this.changeX = 0;
            this.changeY = -1;
            return true;
        }
        return false;
    };

    this.goDown = function () {
        if (this.getLastChangeY() !== -1) {
            this.changeX = 0;
            this.changeY = 1;
            return true;
        }
        return false;
    };

    this.getLastChangeX = function () {
        let firstSegment = this.segments[0];
        return this.x - firstSegment.x;
    };

    this.getLastChangeY = function () {
        let firstSegment = this.segments[0];
        return this.y - firstSegment.y;
    };
}