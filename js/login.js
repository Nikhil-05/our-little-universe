/* =========================================
   SUPABASE CLIENT
========================================= */

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================
   DOM ELEMENTS
========================================= */

const loginForm =
    document.getElementById(
        "loginForm"
    );


const emailInput =
    document.getElementById(
        "email"
    );


const passwordInput =
    document.getElementById(
        "password"
    );


const loginButton =
    document.getElementById(
        "loginButton"
    );


const loginMessage =
    document.getElementById(
        "loginMessage"
    );


/* =========================================
   MESSAGE
========================================= */

function showMessage(
    message,
    type = "error"
) {

    if (!loginMessage) {
        return;
    }


    loginMessage.textContent =
        message;


    loginMessage.className =
        `login-message ${type}`;
}


/* =========================================
   LOGIN
========================================= */

async function handleLogin(
    event
) {

    /*
     * Prevent the browser's normal form
     * submission/reload.
     */

    event.preventDefault();


    const email =
        emailInput.value.trim();


    const password =
        passwordInput.value;


    /* =====================================
       VALIDATION
    ===================================== */

    if (!email) {

        showMessage(
            "Please enter your email."
        );

        emailInput.focus();

        return;
    }


    if (!password) {

        showMessage(
            "Please enter your password."
        );

        passwordInput.focus();

        return;
    }


    /* =====================================
       LOADING STATE
    ===================================== */

    loginButton.disabled =
        true;


    loginButton.textContent =
        "Opening our world... ❤️";


    showMessage(
        ""
    );


    try {

        /* =================================
           SUPABASE LOGIN
        ================================= */

        const {
            data,
            error
        } =
            await supabaseClient.auth.signInWithPassword({

                email:
                    email,

                password:
                    password

            });


        if (error) {

            console.error(
                "Supabase login error:",
                error
            );

            throw error;
        }


        if (
            !data ||
            !data.session
        ) {

            throw new Error(
                "Login completed, but no session was returned."
            );
        }


        /* =================================
           SUCCESS
        ================================= */

        showMessage(
            "Welcome back ❤️",
            "success"
        );


        /*
         * Relative URL works both locally:
         *
         * localhost:5173/login.html
         * → localhost:5173/app.html
         *
         * and on GitHub Pages:
         *
         * /our-little-universe/login.html
         * → /our-little-universe/app.html
         */

        window.location.href =
            new URL(
                "./app.html",
                window.location.href
            ).href;


    } catch (error) {

        console.error(
            "Login failed:",
            error
        );


        showMessage(
            getLoginErrorMessage(
                error
            )
        );


        loginButton.disabled =
            false;


        loginButton.textContent =
            "Enter Our World ❤️";
    }
}


/* =========================================
   ERROR MESSAGE
========================================= */

function getLoginErrorMessage(
    error
) {

    const message =
        String(
            error?.message ||
            ""
        ).toLowerCase();


    if (
        message.includes(
            "invalid login credentials"
        )
    ) {

        return (
            "Email or password is incorrect."
        );
    }


    if (
        message.includes(
            "email not confirmed"
        )
    ) {

        return (
            "Please confirm your email before logging in."
        );
    }


    if (
        message.includes(
            "too many requests"
        )
    ) {

        return (
            "Too many login attempts. Please wait a little and try again."
        );
    }


    return (
        error?.message ||
        "We couldn't log you in. Please try again."
    );
}


/* =========================================
   EVENT LISTENER
========================================= */

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        handleLogin
    );

} else {

    console.error(
        "loginForm was not found."
    );
}