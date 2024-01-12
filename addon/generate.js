const controller = {
    password: undefined,
    elements: {
        body: undefined,
        password: undefined,
        eye: undefined,
        copy: undefined,
        lock: undefined,
    },
    visible: false,
    copied: false,

    init() {
        console.debug('Initializing page controller');
        this.elements.body = document.body;
        this.elements.domain = document.getElementById('domain');
        this.elements.password = document.getElementById('password');
        this.elements.eye = document.getElementById('eye');
        this.elements.copy = document.getElementById('copy');
        this.elements.lock = document.getElementById('lock');
        this.elements.eye.addEventListener('click', () => this.toggleVisibility());
        this.elements.copy.addEventListener('click', async () => await this.copyPassword());
        this.elements.lock.addEventListener('click', () => this.lockMasterPassword());
        console.debug('Page controlled initialized');
    },

    setPassword(domain, password) {
        this.password = password;
        this.elements.domain.innerText = domain;
        this.elements.password.value = password;
        // clear loading class on body
        this.elements.body.className = '';
    },

    toggleVisibility() {
        this.visible = !this.visible;
        if (this.visible) {
            this.elements.password.type = 'text';
            this.elements.eye.className = 'open';
        } else {
            this.elements.password.type = 'password';
            this.elements.eye.className = 'closed';
        }
    },

    async copyPassword() {
        if (this.password === undefined) {
            console.debug('Password not available, not copying');
            return;
        }
        if (this.copied) {
            console.debug('Password already copied to clipboard');
            return;
        }
        console.debug('Copying password to clipboard');
        await navigator.clipboard.writeText(this.password);
        this.elements.copy.className = 'done';
        this.elements.copy.title = 'Password copied to clipboard';
        this.copied = true;
        console.debug('Password copied to clipboard');
    },

    lockMasterPassword() {
        messageController.sendClearMasterPassword();
        window.close();
    },
};

const messageController = {
    port: undefined,

    async init() {
        console.debug('Initializing page message controller');
        this.port = browser.runtime.connect({name: 'page'});
        this.port.onMessage.addListener(message => this.handle(message));
        await this.sendGeneratePassword();
        console.debug('Page message controller initialized');
    },

    handle({type, ...message}) {
        switch (type) {
            case 'password':
                console.debug('Received message: password');
                controller.setPassword(message.domain, message.password);
                break;
            default:
                console.group(`Received unexpected message: ${type}`);
                console.dir(message);
                console.groupEnd();
        }
    },

    async sendGeneratePassword() {
        const tabs = await browser.tabs.query({currentWindow: true, active: true});
        if (!tabs.length) {
            console.warn('No active tab in current window');
            return;
        }
        const tab = tabs[0];
        console.debug('Sending message: generate-password');
        this.port.postMessage({
            type: 'generate-password',
            url: tab.url,
            tabId: tab.id,
        });
    },

    sendClearMasterPassword() {
        console.debug('Sending message: clear-master-password');
        this.port.postMessage({
            type: 'clear-master-password',
        });
    },
};

window.addEventListener('load', async () => {
    console.debug('Initializing page action');
    controller.init();
    await messageController.init();
    console.debug('Page action initialized');
});
