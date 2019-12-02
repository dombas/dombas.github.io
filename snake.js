const CANVAS_ID = 'mainCanvas';
const MIN_SNAKE_LENGTH = 3;
const FEED_GROW = 5;

let boardSizeString = window.location.search.substr(1);
console.log("substring " + boardSizeString);
let boardSizeConverted = parseInt(boardSizeString);
console.log("board size converted " + boardSizeConverted);
let boardSizeInCells;
if (Number.isInteger(boardSizeConverted)) {
    boardSizeInCells = boardSizeConverted;
} else {
    boardSizeInCells = 20;
    console.log("failed to read board size, going with default " + boardSizeInCells);
}
let gameLogic = new GameLogic(boardSizeInCells);
let gameRender = new GameRenderer(gameLogic);
let touchHandler = new TouchHandler(gameLogic);
document.addEventListener('keydown', gameLogic);
document.addEventListener('touchmove', touchHandler);
document.addEventListener('touchstart', function (event) {
    touchHandler.handleTouchStart(event);
});

function gameUpdate() {
    gameLogic.update();
    gameRender.drawFrame(); //TODO change to interval (draw frames 24FPS)
}

gameUpdate();
window.setInterval(gameUpdate, 100);

function TouchHandler(gameLogic) {
    this.gameLogic = gameLogic;
    this.lastTouchX = 0;
    this.lastTouchY = 0;

    let movingAverageWindow = 3;
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
            let snake = this.gameLogic.snakeActor;
            if (Math.abs(sumDiffsX) > Math.abs(sumDiffsY)) {
                if (differenceX > 0) {
                    snake.goLeft();
                } else {
                    snake.goRight();
                }
            } else {
                if (differenceY > 0) {
                    snake.goUp();
                } else {
                    snake.goDown();
                }
            }
        }
    };

    this.handleTouchStart = function (event) {
        console.log("Touch start!");
        this.diffsX = this.diffsX.fill(0);
        this.diffsY = this.diffsY.fill(0);
        let touch = event.touches[0];
        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;
    }
}

function GameLogic(boardSizeInCells) {
    this.snakeActor = new SnakeActor(3, 3);
    this.meatActor = new MeatActor(1, 1);
    this.boardSizeInCells = boardSizeInCells;
    this.handleEvent = function (event) {
        switch (event.key) {
            case "ArrowDown":
                this.snakeActor.goDown();
                break;
            case "ArrowUp":
                this.snakeActor.goUp();
                break;
            case "ArrowLeft":
                this.snakeActor.goLeft();
                break;
            case "ArrowRight":
                this.snakeActor.goRight();
                break;
        }
    };

    this.update = function () {
        //if on top of meat, grow snake, move meat
        if (isSamePosition(this.snakeActor, this.meatActor)) {
            this.snakeActor.feed();
            let randomPosition = getRandomPosition(this.boardSizeInCells);
            this.meatActor.setPosition(randomPosition);
        }
        //if collided with tail, cut off from collision point
        let segments = this.snakeActor.segments;
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
            let segment = segments[segmentIndex];
            if (isSamePosition(this.snakeActor, segment)) {
                this.snakeActor.snakeLength = Math.max(MIN_SNAKE_LENGTH, segmentIndex-1);
                this.snakeActor.segments = segments.slice(0, this.snakeActor.snakeLength);
                break;
            }
        }
        this.snakeActor.move();
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

function GameRenderer(gameLogic) {
    this.canvasElement = document.getElementById(CANVAS_ID);
    this.renderContext = this.canvasElement.getContext('2d');
    let size = Math.min(window.innerWidth, window.innerHeight);
    this.renderContext.canvas.width = size;
    this.renderContext.canvas.height = size;
    this.canvasWidth = this.canvasElement.getAttribute('width');
    this.canvasHeight = this.canvasElement.getAttribute('height');

    this.gameLogic = gameLogic;

    this.borderThickness = 5;
    this.borderColor = '#060';

    this.meatColor = '#900';

    this.snakeColor = '#0A0';

    let cellTableObject = makeCellTable(this, this.gameLogic.boardSizeInCells);
    this.cellSize = cellTableObject.cellSize;
    this.cellTable = cellTableObject.cellTable;

    this.drawFrame = function () {

        clearFrame(this);
        drawGameBorder(this);
        let meat = this.gameLogic.meatActor;
        drawMeat(this, meat.y, meat.x);

        drawSnake(this, gameLogic.snakeActor);

        function clearFrame(gameRenderer) {
            let ctx = gameRenderer.renderContext;
            let width = gameRenderer.canvasWidth;
            let height = gameRenderer.canvasHeight;
            ctx.clearRect(0, 0, width, height);
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
            let snakeSegments = snakeActor.segments;
            for (let segmentIndex = 0; segmentIndex < snakeSegments.length; segmentIndex++) {
                let segment = snakeSegments[segmentIndex];
                drawSnakeSegment(gameRenderer, segment.y, segment.x);
            }
        }

        function drawSnakeSegment(gameRenderer, row, col) {
            drawFillCell(gameRenderer, row, col, gameRenderer.snakeColor);
        }

        function drawMeat(gameRenderer, row, col) {
            drawFillCell(gameRenderer, row, col, gameRenderer.meatColor);
        }

        function drawFillCell(gameRenderer, row, col, color) {
            let ctx = gameRenderer.renderContext;
            let cellSize = gameRenderer.cellSize;
            let cell = gameRenderer.cellTable[row][col];
            ctx.fillStyle = color;
            ctx.fillRect(cell.x, cell.y, cellSize, cellSize);
        }
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
        console.log("useful size " + usefulSize);
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
    this.snakeLength = MIN_SNAKE_LENGTH;
    this.segments = Array();

    this.feed = function () {
        this.snakeLength += FEED_GROW;
    };

    this.move = function () {
        this.segments.unshift({
            'x': this.x,
            'y': this.y
        });
        //TODO maybe move this into GameLogic?
        if (this.segments.length > this.snakeLength - 1) {
            this.segments.pop();
        }
        this.x += this.changeX;
        this.y += this.changeY;
    };

    //TODO it's still possible to to do a 180 in place
    // instead of checking changeX/Y, check the first segment location
    // wrap around the walls (maybe a function for wrapping Position).
    this.goRight = function () {
        if (this.changeX !== -1) {
            this.changeY = 0;
            this.changeX = 1;
        }
    };

    this.goLeft = function () {
        if (this.changeX !== 1) {
            this.changeY = 0;
            this.changeX = -1;
        }
    };

    this.goUp = function () {
        if (this.changeY !== 1) {
            this.changeX = 0;
            this.changeY = -1;
        }
    };

    this.goDown = function () {
        if (this.changeY !== -1) {
            this.changeX = 0;
            this.changeY = 1;
        }
    }
}