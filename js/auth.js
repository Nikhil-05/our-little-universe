const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");


if (loginForm) {

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;


        loginMessage.textContent = "Entering our little universe... ❤️";


        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });


        if (error) {

            console.error(error);

            loginMessage.textContent =
                "Couldn't log you in. Please check your details.";

            return;
        }


        console.log("Logged in:", data.user);

        window.location.href = "app.html";
    });
}