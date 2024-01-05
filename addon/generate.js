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
        console.group('Initializing page controller');
        try {
            this.elements.body = document.body;
            this.elements.domain = document.getElementById('domain');
            this.elements.password = document.getElementById('password');
            this.elements.eye = document.getElementById('eye');
            this.elements.copy = document.getElementById('copy');
            this.elements.lock = document.getElementById('lock');
            this.elements.eye.addEventListener('click', () => this.toggleVisibility());
            this.elements.copy.addEventListener('click', () => this.copyPassword());
            this.elements.lock.addEventListener('click', () => this.lockMasterPassword());
            console.debug('Page controlled initialized');
        } finally {
            console.groupEnd();
        }
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

    copyPassword() {
        if (this.password === undefined) {
            console.debug('Password not available, not copying');
            return;
        }
        if (this.copied) {
            console.debug('Password already copied to clipboard');
            return;
        }
        navigator.clipboard.writeText(this.password).then(() => {
            this.elements.copy.className = 'done';
            this.elements.copy.title = 'Password copied to clipboard';
            this.copied = true;
            console.debug('Password copied to clipboard');
        }).catch(error => {
            console.error(`Could not copy password to clipboard: ${error}`);
        });
    },

    lockMasterPassword() {
        messageController.sendClearMasterPassword();
        window.close();
    },
};

const messageController = {
    port: undefined,

    init() {
        console.group('Initializing page message controller');
        try {
            this.port = browser.runtime.connect({name: 'page'});
            this.port.onMessage.addListener(message => this.handle(message));
            this.sendGenerate();
            console.debug('Page message controller initialized');
        } finally {
            console.groupEnd();
        }
    },

    handle({type, ...message}) {
        switch (type) {
            case 'password':
                console.debug('Received message: password');
                controller.setPassword(message.domain, message.password);
                break;
            default:
                console.warn(`Received unexpected message: ${type}`);
                console.dir(message);
        }
    },

    sendGenerate() {
        browser.tabs.query({currentWindow: true, active: true}).then(tabs => {
            if (!tabs.length) {
                console.warn('No active tab in current window');
                return;
            }
            const tab = tabs[0];
            console.group('Sending message: generate-password');
            try {
                this.port.postMessage({
                    type: 'generate-password',
                    url: tab.url,
                    tabId: tab.id,
                });
            } finally {
                console.groupEnd();
            }
        });
    },

    sendClearMasterPassword() {
        console.group('Sending message: clear-master-password');
        try {
            this.port.postMessage({
                type: 'clear-master-password',
            });
        } finally {
            console.groupEnd();
        }
    },
};

window.addEventListener('load', () => {
    console.group('Initializing page script');
    try {
        controller.init();
        messageController.init();
    } finally {
        console.groupEnd();
    }
});
