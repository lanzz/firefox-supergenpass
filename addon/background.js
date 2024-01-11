import md5 from './md5.js';
import TLD_LIST from './tld.js';

const DEFAULT_SECRET = '';
const DEFAULT_LENGTH = 10;

const IP_REGEXP = new RegExp('^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})$');

const controller = {
    password: null,
    passwordPrompt: undefined,

    init() {
        console.debug('Initializing background controller');
        browser.windows.onRemoved.addListener(windowId => this.windowClosed(windowId));
        console.debug('Background controller initialized');
    },

    async getOptions() {
        console.debug('Getting options from sync storage');
        const options = await browser.storage.sync.get({
            secret: DEFAULT_SECRET,
            len: DEFAULT_LENGTH,
        });
        console.debug('Retrieved options from sync storage');
        return options;
    },

    async setOptions(options) {
        console.debug('Storing options in sync storage');
        await browser.storage.sync.set({
            len: options.len,
            secret: options.secret,
        });
        console.debug('Persisted options in sync storage');
    },

    async getMasterPassword() {
        const {masterPassword} = await browser.storage.session.get({masterPassword: undefined});
        if (masterPassword !== undefined) {
            console.debug('Retrieved master password from session storage');
            return masterPassword;
        }
        console.debug('Master password not available');
        return await this.promptForMasterPassword();
    },

    async setMasterPassword(password) {
        await brower.storage.session.set({masterPassword: password});
        console.debug('Master password set');
        if (this.passwordPrompt) {
            console.debug('Resolving password promise');
            this.passwordPrompt.resolve(password);
            this.passwordPrompt.resolved = true;
        }
        console.debug('Closing password prompt window');
        this.closePasswordPrompt();
    },

    async clearMasterPassword() {
        await browser.storage.session.remove('masterPassword');
        console.debug('Cleared master password in session storage');
        this.closePasswordPrompt();
    },

    async promptForMasterPassword() {
        if (this.passwordPrompt) {
            console.debug('Password prompt window already open');
            this.focusPopup();
            return this.passwordPrompt.promise;
        }
        console.debug('Creating password prompt window');
        const windowInfo = await browser.windows.create({
            type: 'panel',
            url: 'password.html',
            width: 500,
            height: 250,
            left: Math.round((window.screen.width - 500) / 2),
            top: Math.round((window.screen.height - 200) / 2 - 100),
        });
        console.debug(`Password prompt window created (windowId=${windowInfo.id})`);
        const {promise, resolve, reject} = Promise.withResolvers();
        this.passwordPrompt = {
            window: windowInfo,
            promise,
            resolve,
            reject,
            resolved: false,
        };
        return await promise;
    },

    focusPopup() {
        console.debug(`Drawing attention to password prompt (windowId=${this.passwordPrompt.window.id})`);
        browser.windows.update(this.passwordPrompt.window.id, {
            drawAttention: true,
            focused: true,
        });
    },

    closePasswordPrompt() {
        if (!this.passwordPrompt) {
            console.debug('Password prompt window is not open');
            return;
        }
        console.debug(`Closing master password prompt window (windowId=${this.passwordPrompt.window.id})`);
        browser.windows.remove(this.passwordPrompt.window.id);
    },

    windowClosed(windowId) {
        if (!this.passwordPrompt || (windowId != this.passwordPrompt.window.id)) {
            return;
        }
        console.debug(`Password prompt window closed (windowId=${windowId})`);
        if (!this.passwordPrompt.resolved) {
            console.debug('Rejecting password promise');
            this.passwordPrompt.reject(new Error('Password prompt closed'));
        }
        console.debug('Clearing password prompt window state');
        this.passwordPrompt = undefined;
    },

    async generatePassword(uri) {
        console.debug(`Generating password for ${uri}`);
        const [masterPassword, options] = await Promise.all([
            this.getMasterPassword(),
            this.getOptions(),
        ]);

        const domain = this.extractDomain(uri);
        let password = masterPassword + options.secret + ':' + domain;

        let i = 0;
        while (i < 10 || !(this.checkPassword(password.substring(0, options.len)))) {
            password = md5(password);
            i++;
        }
        password = password.substring(0, options.len);
        return {
            domain,
            password,
        };
    },

    extractDomain(uri) {
        console.debug(`Extracting domain name from ${uri}`);
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
    },

    checkPassword(password) {
        return (password.search(/[a-z]/) === 0 && password.search(/[0-9]/) > 0 && password.search(/[A-Z]/) > 0)? true: false;
    },
};

const messageController = {
    ports: {
        options: [],
        page: [],
        password: [],
    },

    init() {
        console.debug('Initializing background message controller');
        browser.runtime.onConnect.addListener(port => this.connected(port));
        console.debug('Background message controller initialized');
    },

    connected(port) {
        switch (port.name) {
            case 'options':
                console.debug(`Opened options connection: ${port.sender.contextId}`);
                port.onMessage.addListener(async message => await this.handleOptionsMessage(port, message));
                port.onDisconnect.addListener(port => this.closePort(port, 'options'));
                break;
            case 'page':
                console.debug(`Opened page connection: ${port.sender.contextId}`);
                port.onMessage.addListener(async message => await this.handlePageMessage(port, message));
                port.onDisconnect.addListener(port => this.closePort(port, 'page'));
                break;
            case 'password':
                console.debug(`Opened password connection: ${port.sender.contextId}`);
                port.onMessage.addListener(async message => await this.handlePasswordMessage(port, message));
                port.onDisconnect.addListener(port => this.closePort(port, 'password'));
                break;
            default:
                console.warn(`Unexpected connection type: ${port.name}`);
                port.disconnect();
        }
    },

    closePort(port, type) {
        if (port.error) {
            console.error(`Closed ${type} connection: ${port.sender.contextId}: ${port.error}`);
        } else {
            console.debug(`Closed ${type} connection: ${port.sender.contextId}`);
        }
        port.closed = true;
    },

    async handleOptionsMessage(port, {type, ...message}) {
        switch (type) {
            case 'get-options':
                console.debug(`Received message: get-options (port=${port.sender.contextId})`);
                const options = await controller.getOptions();
                console.debug(`Responding to get-options request (port=${port.sender.contextId})`);
                port.postMessage({
                    type: 'options',
                    ...options,
                });
                break;
            case 'update-options':
                console.debug(`Received message: update-options (port=${port.sender.contextId})`);
                await controller.setOptions(message);
                break;
            default:
                console.group(`Received unexpected message from options dialog: ${type} (port=${port.sender.contextId})`);
                console.dir(message);
                console.groupEnd();
        }
    },

    async handlePageMessage(port, {type, ...message}) {
        switch (type) {
            case 'generate-password':
                console.debug(`Received message: generate-password (port=${port.sender.contextId}, url=${message.url})`);
                await this.generatePassword(port, message);
                break;
            case 'clear-master-password':
                console.debug(`Received message: clear-master-password (url=${message.url})`);
                await controller.clearMasterPassword();
                break;
            default:
                console.group(`Received unexpected message from page action: ${type} (port=${port.sender.contextId})`);
                console.dir(message);
                console.groupEnd();
        }
    },

    async generatePassword(port, {url}) {
        try {
            const {domain, password} = await controller.generatePassword(url);
            console.debug(`Responding to generate-password request (port=${port.sender.contextId})`);
            if (port.closed) {
                console.debug('Port already closed');
                return;
            }
            port.postMessage({
                type: 'password',
                domain: domain,
                password: password,
            });
        } catch(error) {
            console.error(error);
            console.debug(`Rejecting generate-password request (port=${port.sender.contextId}): ${error.message}`);
            if (port.closed) {
                console.debug('Port already closed');
            } else {
                port.postMessage({
                    type: 'password-not-available',
                    error: error.message,
                });
            }
            throw error;
        }
    },

    async handlePasswordMessage(port, {type, ...message}) {
        switch (type) {
            case 'set-master-password':
                console.debug(`Received message: set-master-password (port=${port.sender.contextId})`);
                await controller.setMasterPassword(message.password);
                break;
            case 'cancel':
                console.debug(`Received message: cancel (port=${port.sender.contextId})`);
                controller.closePasswordPrompt();
                break;
            default:
                console.warn(`Received unexpected message from password dialog: ${type} (port=${port.sender.contextId})`);
                console.dir(message);
        }
    },
};

console.debug('Initializing extension');
controller.init();
messageController.init();
console.debug('Extension initialized');

window.controller = controller;
window.messageController = messageController;