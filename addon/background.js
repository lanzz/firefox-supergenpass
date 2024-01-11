import md5 from './md5.js';
import TLD_LIST from './tld.js';

const DEFAULT_SECRET = '';
const DEFAULT_LENGTH = 10;

const IP_REGEXP = new RegExp('^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})$');

const controller = {
    password: null,
    secret: undefined,
    len: undefined,
    promptWindow: undefined,
    passwordPromises: [],
    optionsPromises: [],

    init() {
        console.group('Initializing background controller');
        try {
            browser.storage.sync.get({
                secret: DEFAULT_SECRET,
                len: DEFAULT_LENGTH,
            }).then(options => {
                console.debug('Retrieved options from sync storage');
                this.setOptions(options);
            });
            browser.windows.onRemoved.addListener(windowId => this._windowClosed(windowId));
            console.debug('Background controller initialized');
        } finally {
            console.groupEnd();
        }
    },

    getMasterPassword() {
        const promise = new Promise((resolve, reject) => {
            if (this.password) {
                console.debug('Master password available');
                resolve(this.password);
                return;
            }
            console.debug('Master password not available, opening prompt');
            this.passwordPromises.push([resolve, reject]);
            this._openMasterPasswordPopup();
        });
        return promise;
    },

    _openMasterPasswordPopup() {
        if (this.promptWindow) {
            this._focusPopup();
            return;
        }
        console.debug('Creating master password prompt window');
        const creating = browser.windows.create({
            type: 'panel',
            url: 'password.html',
            width: 500,
            height: 250,
            left: Math.round((window.screen.width - 500) / 2),
            top: Math.round((window.screen.height - 200) / 2 - 100),
        });
        creating.then(windowInfo => {
            console.debug(`Master password prompt window created (windowId=${windowInfo.id})`);
            this.promptWindow = windowInfo;
        }, error => {
            console.error(`Could not open master password prompt window: ${error}`);
        });
    },

    _focusPopup() {
        console.group(`Master password prompt window already open, drawing attention (windowId=${this.promptWindow.id})`);
        try {
            browser.windows.update(this.promptWindow.id, {
                drawAttention: true,
                focused: true,
            });
        } finally {
            console.groupEnd();
        }
    },

    closeMasterPasswordPopup() {
        if (this.promptWindow === undefined) {
            console.debug('No master password prompt window to close');
            return;
        }
        console.debug(`Closing master password prompt window (windowId=${this.promptWindow.id})`);
        browser.windows.remove(this.promptWindow.id);
    },

    _windowClosed(windowId) {
        if (!this.promptWindow || (windowId != this.promptWindow.id)) {
            return;
        }
        console.group(`Master password prompt window closed (windowId=${windowId})`);
        try {
            console.debug('Clearing master password prompt window state');
            this.promptWindow = undefined;
            if (this.passwordPromises.length) {
                const error = new Error('Password prompt closed');
                console.debug(`Rejecting ${this.passwordPromises.length} pending promises`);
                this.passwordPromises.forEach(([resolve, reject]) => reject(error));
                this.passwordPromises = [];
            } else {
                console.debug('No pending promises');
            }
        } finally {
            console.groupEnd();
        }
    },

    setMasterPassword(password) {
        console.group('Master password set');
        try {
            this.password = password;
            if (this.passwordPromises) {
                console.debug(`Resolving ${this.passwordPromises.length} pending promises`);
                this.passwordPromises.forEach(([resolve, reject]) => resolve(password));
                this.passwordPromises = [];
            } else {
                console.debug('No pending promises');
            }
            this.closeMasterPasswordPopup();
        } finally {
            console.groupEnd();
        }
    },

    generatePassword(uri) {
        console.debug(`Generating password for ${uri}`);
        return new Promise((resolve, reject) => {
            this.getMasterPassword().then(masterPassword => {
                console.group(`Resolving password request for ${uri}`);
                try {
                    const domain = this._extractDomain(uri);
                    console.debug(`Domain name: ${domain}`);
                    let password = masterPassword + this.secret + ':' + domain;

                    let i = 0;
                    while (i < 10 || !(this._checkPassword(password.substring(0, this.len)))) {
                        password = md5(password);
                        i++;
                    }
                    resolve({
                        domain: domain,
                        password: password.substring(0, this.len),
                    });
                } finally {
                    console.groupEnd();
                }
            }).catch(error => {
                console.debug(`Master password prompt was rejected, rejecting request for ${uri}`);
                reject(error);
            });
        });
    },

    _extractDomain(uri) {
        console.group(`Extracting domain name from ${uri}`);
        try {
            const url = new URL(uri);

            if ((url.protocol === 'file:') && (url.hostname === '')) {
                console.debug('Domain name: localhost (for file:/// URI)');
                return 'localhost';
            }

            if (url.hostname.match(IP_REGEXP)) {
                console.debug(`Domain name: ${url.hostname} (IPv4 address)`);
                return url.hostname;
            }

            const parts = url.hostname.split('.');
            let domain = parts[parts.length - 2] + '.' + parts[parts.length - 1];
            for (let i = 0; i < TLD_LIST.length; i++) {
                if (domain == TLD_LIST[i]) {
                    domain = parts[parts.length - 3] + '.' + domain;
                    console.debug(`Detected multi-level eTLD: ${TLD_LIST[i]}`);
                    break;
                }
            }
            console.debug(`Domain name: ${domain}`);
            return domain;
        } finally {
            console.groupEnd();
        }
    },

    _checkPassword(password) {
        return (password.search(/[a-z]/) === 0 && password.search(/[0-9]/) > 0 && password.search(/[A-Z]/) > 0)? true: false;
    },

    clearMasterPassword() {
        this.password = null;
    },

    getOptions() {
        return new Promise(resolve => {
            if ((this.len === undefined) || (this.secret === undefined)) {
                console.debug('Options not available yet, enqueueing');
                this.optionsPromises.push(resolve);
                return;
            }
            console.debug('Options available, resolving promise immediately');
            resolve({
                len: this.len,
                secret: this.secret,
            });
        });
    },

    setOptions(options) {
        console.group('Updating options');
        try {
            this.len = options.len;
            this.secret = options.secret;
            browser.storage.sync.set({
                len: this.len,
                secret: this.secret,
            });
            if (this.optionsPromises.length) {
                console.debug(`Resolving ${this.optionsPromises.length} pending options requests`);
                this.optionsPromises.forEach(resolve => resolve({
                    len: this.len,
                    secret: this.secret,
                }));
                this.optionsPromises = [];
            }
        } finally {
            console.groupEnd();
        }
    },
};

const messageController = {
    ports: {
        options: [],
        page: [],
        password: [],
    },

    init() {
        console.group('Initializing background message controller');
        try {
            browser.runtime.onConnect.addListener(port => this.connected(port));
            console.debug('Background message controller initialized');
        } finally {
            console.groupEnd();
        }
    },

    connected(port) {
        switch (port.name) {
            case 'options':
                console.group(`Opened options connection: ${port.sender.contextId}`);
                try {
                    port.onMessage.addListener(message => this._handleOptionsMessage(port, message));
                    port.onDisconnect.addListener(port => this._closePort(port, 'options'));
                } finally {
                    console.groupEnd();
                }
                break;
            case 'page':
                console.group(`Opened page connection: ${port.sender.contextId}`);
                try {
                    port.onMessage.addListener(message => this._handlePageMessage(port, message));
                    port.onDisconnect.addListener(port => this._closePort(port, 'page'));
                } finally {
                    console.groupEnd();
                }
                break;
            case 'password':
                console.group(`Opened password connection: ${port.sender.contextId}`);
                try {
                    port.onMessage.addListener(message => this._handlePasswordMessage(port, message));
                    port.onDisconnect.addListener(port => this._closePort(port, 'password'));
                } finally {
                    console.groupEnd();
                }
                break;
            default:
                console.warn(`Unexpected connection type: ${port.name}`);
                port.disconnect();
        }
    },

    _closePort(port, type) {
        if (port.error) {
            console.error(`Closed ${type} connection: ${port.sender.contextId}: ${port.error}`);
        } else {
            console.debug(`Closed ${type} connection: ${port.sender.contextId}`);
        }
        port.closed = true;
    },

    _handleOptionsMessage(port, {type, ...message}) {
        switch (type) {
            case 'get-options':
                console.group(`Received message: get-options (port=${port.sender.contextId})`);
                try {
                    controller.getOptions().then(options => {
                        console.debug(`Responding to get-options request (port=${port.sender.contextId})`);
                        const message = {
                            type: 'options',
                            ...options,
                        };
                        port.postMessage(message);
                    });
                } finally {
                    console.groupEnd();
                }
                break;
            case 'update-options':
                console.group(`Received message: update-options (port=${port.sender.contextId})`);
                try {
                    controller.setOptions(message);
                } finally {
                    console.groupEnd();
                }
                break;
            default:
                console.group(`Received unexpected message from options dialog: ${type} (port=${port.sender.contextId})`);
                console.dir(message);
                console.groupEnd();
        }
    },

    _handlePageMessage(port, {type, ...message}) {
        switch (type) {
            case 'generate-password':
                console.debug(`Received message: generate-password (url=${message.url})`);
                controller.generatePassword(message.url).then(({domain, password}) => {
                    console.group(`Responding to generate-password request (port=${port.sender.contextId})`);
                    try {
                        if (port.closed) {
                            console.debug('Port already closed');
                            return;
                        }
                        port.postMessage({
                            type: 'password',
                            domain: domain,
                            password: password,
                        });
                    } finally {
                        console.groupEnd();
                    }
                }).catch(error => {
                    console.group(`Rejecting generate-password request (port=${port.sender.contextId}): ${error}`);
                    try {
                        if (port.closed) {
                            console.debug('Port already closed');
                            return;
                        }
                        port.postMessage({
                            type: 'password-not-available',
                        });
                    } finally {
                        console.groupEnd();
                    }
                });
                break;
            case 'clear-master-password':
                console.debug(`Received message: clear-master-password (url=${message.url})`);
                controller.clearMasterPassword();
                break;
            default:
                console.group(`Received unexpected message from page action: ${type} (port=${port.sender.contextId})`);
                console.dir(message);
                console.groupEnd();
        }
    },

    _handlePasswordMessage(port, {type, ...message}) {
        switch (type) {
            case 'set-master-password':
                console.debug(`Received message: set-master-password (port=${port.sender.contextId})`);
                controller.setMasterPassword(message.password);
                break;
            case 'cancel':
                console.debug(`Received message: cancel (port=${port.sender.contextId})`);
                controller.closeMasterPasswordPopup();
                break;
            default:
                console.warn(`Received unexpected message from password dialog: ${type} (port=${port.sender.contextId})`);
                console.dir(message);
        }
    },
};

console.debug('Initializing extension');
try {
    controller.init();
    messageController.init();
} finally {
    console.debug('Extension initialized');
}
