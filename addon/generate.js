import { PSD_LIST, MAX_PSD_LEVELS } from './psd_list.js';

const IP_REGEXP = new RegExp('^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})$');

const controller = {
    password: undefined,
    visible: false,
    copied: false,

    async init() {
        console.debug('Initializing page controller');
        document.getElementById('eye').addEventListener('click', () => this.toggleVisibility());
        document.getElementById('copy').addEventListener('click', async () => await this.copyPassword());
        document.getElementById('lock').addEventListener('click', () => this.lockMasterPassword());
        await this.initHostname();
        console.debug('Page controlled initialized');
    },

    async initHostname() {
        const parts = await this.getHostnameParts();
        document.getElementById('hostname').innerHTML = '';
        for (let i = 0; i < parts.length; i++) {
            this.buildHostnamePartLabel(parts, i);
        }
        const skip = (parts.length > 1)? this.determineHostnameSkip(parts): 0;
        this.setHostname(parts.slice(skip).join('.'), skip);
    },

    async getHostnameParts() {
        const tabs = await browser.tabs.query({currentWindow: true, active: true});
        if (!tabs.length) {
            console.warn('No active tab in current window');
            return;
        }
        const url = new URL(tabs[0].url);
        if ((url.protocol === 'file:') && (url.hostname === '')) {
            console.debug('Hostname: localhost (for file:/// URI)');
            return ['localhost'];
        } else if (url.hostname.match(IP_REGEXP)) {
            console.debug(`Hostname: ${url.hostname} (IPv4 address)`);
            return [url.hostname];
        } else {
            console.debug(`Hostname: ${url.hostname}`);
            return url.hostname.split('.');
        }
    },

    buildHostnamePartLabel(parts, skip) {
        const label = document.createElement('span');
        label.innerText = parts[skip];
        if (skip + 1 < parts.length) {
            label.innerText += '.';
        }
        document.getElementById('hostname').appendChild(label);
        label.addEventListener('click', ev => {
            if (ev.button != 0) {
                return;
            }
            const subdomain = parts.slice(skip).join('.');
            console.debug(`Clicked subdomain ${subdomain} (skip=${skip})`);
            ev.preventDefault();
            this.setHostname(subdomain, skip);
            return false;
        });
    },

    determineHostnameSkip(parts) {
        console.debug(`Searching for PSD in ${parts.join('.')}`);
        for (let length = MAX_PSD_LEVELS; length > 1; length -= 1) {
            const candidatePSD = parts.slice(-length).join('.');
            if (PSD_LIST.includes(candidatePSD)) {
                console.debug(`Matched PSD: .${candidatePSD}`);
                return parts.slice(0, -(length + 1)).length;
            }
        }
        console.debug(`Plain TLD: ${parts.slice(-1)[0]}`);
        return parts.slice(0, -2).length;
    },

    setHostname(hostname, skip) {
        if (this.domain == hostname) {
            return;
        }
        console.debug(`Setting hostname to ${hostname} (skip=${skip})`);
        this.domain = hostname;
        const labels = document.getElementById('hostname').children;
        for (let i = 0; i < labels.length; i++) {
            if (i < skip) {
                labels[i].className = 'skipped';
            } else {
                labels[i].className = '';
            }
        }
        document.body.className = 'loading';
        messageController.sendGeneratePassword(this.domain);
    },

    setPassword(password) {
        this.password = password;
        document.getElementById('password').value = password;
        const copy = document.getElementById('copy');
        copy.className = '';
        copy.title = 'Copy password to clipboard';
        this.copied = false;
        // clear loading class on body after a tiny delay
        setTimeout(() => document.body.className = '', 100);
    },

    toggleVisibility() {
        this.visible = !this.visible;
        const password = document.getElementById('password');
        const eye = document.getElementById('eye');
        if (this.visible) {
            password.type = 'text';
            eye.className = 'open';
        } else {
            password.type = 'password';
            eye.className = 'closed';
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
        const copy = document.getElementById('copy');
        copy.className = 'done';
        copy.title = 'Password copied to clipboard';
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
        console.debug('Page message controller initialized');
    },

    handle({type, ...message}) {
        switch (type) {
            case 'password':
                console.debug('Received message: password');
                controller.setPassword(message.password);
                break;
            default:
                console.group(`Received unexpected message: ${type}`);
                console.dir(message);
                console.groupEnd();
        }
    },

    sendGeneratePassword(domain) {
        console.debug('Sending message: generate-password');
        this.port.postMessage({
            type: 'generate-password',
            domain: domain,
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
    await messageController.init();
    await controller.init();
    console.debug('Page action initialized');
});
