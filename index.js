const cgHelper = require('./sii-cg-helper').SIICgHelper,
    CHARACTERS = require('./sii-cg-helper').CHARACTERS,
    ACTIONS = require('./sii-cg-helper').ACTIONS
GAME_STATUS = require('./sii-cg-helper').GAME_STATUS,
    debug = require('debug')('http');

class IA {
    constructor() {
        this.mode = null;
        this.gameName = null;
        this.gameVersusPlayer = null;
        this.gameToken = null;
        this.character = null;
        this.playerName = 'DEFAULT_PLAYER_NAME';
        this.playerKey = cgHelper.generateUniquePlayerKey();
        this.speed = 0;
    }

    main() {


        if (process.argv.length < 3 || ['CREATE', 'JOIN'].indexOf(process.argv[2]) === -1) {
            debug('CREATE or JOIN argument is required');
            process.exit();
        }

        this.mode = process.argv[2];

        if (this.mode === 'CREATE') {
            if (process.argv.length < 4) {
                debug('Game name argument is required');
                process.exit();
            }
            this.gameName = process.argv[3];

            this.gameVersusPlayer = (process.argv.length >= 7) ? process.argv[6] : false;

        }

        if (this.mode === 'JOIN') {

            if (process.argv.length < 4) {
                debug('Game Token argument is required');
                process.exit();
            }
            this.gameToken = process.argv[3];
        }

        if (process.argv.length < 5) {
            debug('Character argument is required');
            process.exit();
        }

        if ([CHARACTERS.DRUID, CHARACTERS.PALADIN, CHARACTERS.WARRIOR, CHARACTERS.SORCERER].indexOf(process.argv[4]) === -1) {
            debug('Character need to be DRUID, PALADIN, WARRIOR or SORCERER');
            process.exit();
        }

        this.character = process.argv[4];
        this.playerName = (process.argv.length >= 6) ? process.argv[5] : this.playerName;

        if (this.mode === 'CREATE') {
            this.createGame(this.gameName, this.gameVersusPlayer, this.playerKey, this.character, this.playerName);
        } else {
            this.joinGame(this.gameToken, this.playerKey, this.character, this.playerName);
        }
    }

    createGame(gameName, gameVersusPlayer, playerKey, character, playerName) {
        debug('Create Game "%s", Versus mode %s, character %s, Player "%s"', gameName, gameVersusPlayer, character, playerName);

        cgHelper.createGame(gameName, false, gameVersusPlayer)
            .then(data => {
                debug(data);
                this.gameToken = data.token;
                this.speed = data.speed;

                return this.gameToken;
            })
            .then(gameToken => this.joinGame(gameToken, playerKey, character, playerName))
            .catch(e => debug(e));
    }

    joinGame(gameToken, playerKey, character, playerName) {
        debug('Game Token %s, character %s, Player "%s"', gameToken, character, playerName);
        cgHelper.joinGameWithCountDown(gameToken, playerKey, playerName, character)
            .then(this.startPlaying.bind(this))
            .catch(e => debug(e));
    }

    startPlaying() {
        /*
            MAKE YOUR IA HERE
         */

        this.makeAction();
    }

    makeAction() {
        /*
            MAKE YOUR IA HERE

            EXEMPLE: This Code use the HIT attack only and catch http error from the server
         */
        cgHelper.makeActionWithCoolDown(this.gameToken, this.playerKey, ACTIONS.HIT)
            .then(() => this.makeAction())
            .catch((error) => {
                if (error.statusCode) {
                    switch (error.statusCode) {
                        case 423: {
                            debug('Too fast');

                            cgHelper.wait(300)
                                .then(this.makeAction());
                            break;
                        }
                        case 410: {
                            debug('Game Ended');

                            cgHelper.getGame(this.gameToken, this.playerKey)
                                .then(data => {
                                    debug(data.me.healthPoints === 0 ? 'You Lose' : 'You Win');
                                    debug('You: %s', data.me.healthPoints);
                                    debug('Other: %s', data.foe.healthPoints);
                                });
                            break;
                        }
                        default: {
                            debug(error);
                        }
                    }

                }
            });
    }
}

new IA().main();