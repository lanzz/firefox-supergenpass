const controller = {
    form: undefined,
    inputs: {},

    init() {
        console.group('Initializing password controller');
        try {
            this.form = document.getElementById('password-form');
            this.inputs.password = document.getElementById('password');
            this.form.addEventListener('submit', ev => this._submit(ev));
            this.inputs.password.addEventListener('blur', ev => this._focusPassword(ev));
            document.body.addEventListener('keyup', ev => this._keyHandler(ev));
            this._focusPassword();
            console.debug('Password controller initialized');
        } finally {
            console.groupEnd();
        }
    },

    _focusPassword(ev) {
        setTimeout(() => this.inputs.password.focus(), 0);
    },

    _keyHandler(ev) {
        if ((ev.key === 'Escape') && !ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
            messageController.sendCancel();
            ev.preventDefault();
            return false;
        }
    },

    _submit(ev) {
        ev.preventDefault();
        if (!this.inputs.password.value.length) {
            console.debug('Empty input, not setting master password');
            return false;
        }
        console.group('Setting master password');
        try {
            messageController.sendSetMasterPassword(this.inputs.password.value);
        } finally {
            console.groupEnd();
        }
        this.form.reset();
        return false;
    },
};

const messageController = {
    port: undefined,

    init() {
        console.group('Initializing options message controller');
        try {
            this.port = browser.runtime.connect({name: 'password'});
            console.debug('Options message controller initialized');
        } finally {
            console.groupEnd();
        }
    },

    sendSetMasterPassword(password) {
        console.group('Sending message: set-master-password');
        try {
            this.port.postMessage({
                type: 'set-master-password',
                password: password,
            });
        } finally {
            console.groupEnd();
        }
    },

    sendCancel() {
        console.group('Sending message: cancel');
        try {
            this.port.postMessage({
                type: 'cancel',
            });
        } finally {
            console.groupEnd();
        }
    }
};

window.addEventListener('load', () => {
    console.group('Initializing password dialog');
    try {
        messageController.init();
        controller.init();
    } finally {
        console.groupEnd();
    }
});
