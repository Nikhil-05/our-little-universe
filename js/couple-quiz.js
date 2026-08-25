/* =========================================================
   OUR LITTLE UNIVERSE
   COUPLE QUIZ

   Supported question types:
   1. mcq  - multiple choice, one or more correct answers
   2. text - one-word text answer, case insensitive
========================================================= */

let coupleQuizSupabase = null;
let coupleQuizSession = null;
let coupleQuizPendingQuestion = null;

let coupleQuizInitialized = false;
let coupleQuizListenersReady = false;
let coupleQuizAuthListenerReady = false;


/* =========================================================
   SUPABASE
========================================================= */

function ensureCoupleQuizClient() {

    if (coupleQuizSupabase) {
        return coupleQuizSupabase;
    }

    if (!window.supabase?.createClient) {
        throw new Error(
            "Supabase client library is not loaded."
        );
    }

    if (
        typeof SUPABASE_URL === "undefined" ||
        typeof SUPABASE_KEY === "undefined"
    ) {
        throw new Error(
            "Supabase configuration is not loaded."
        );
    }

    coupleQuizSupabase =
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );

    return coupleQuizSupabase;
}


/* =========================================================
   HELPERS
========================================================= */

function quizEl(id) {
    return document.getElementById(id);
}


function quizEscape(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value == null
            ? ""
            : String(value);

    return div.innerHTML;
}


function normalizeQuizOptions(options) {

    if (Array.isArray(options)) {

        return options
            .map(option => {

                if (
                    !option ||
                    typeof option !== "object"
                ) {
                    return null;
                }

                return {
                    id: String(
                        option.id ?? ""
                    ),
                    text: String(
                        option.text ??
                        option.label ??
                        option.value ??
                        ""
                    )
                };
            })
            .filter(
                option =>
                    option &&
                    option.id &&
                    option.text
            );
    }


    if (
        options &&
        typeof options === "object"
    ) {

        return Object.entries(options)
            .map(([id, value]) => {

                if (
                    value &&
                    typeof value === "object"
                ) {
                    return {
                        id: String(
                            value.id ?? id
                        ),
                        text: String(
                            value.text ??
                            value.label ??
                            value.value ??
                            ""
                        )
                    };
                }

                return {
                    id: String(id),
                    text: String(value)
                };
            })
            .filter(
                option =>
                    option.id &&
                    option.text
            );
    }


    return [];
}


/* =========================================================
   MODAL / GATE
========================================================= */

function setQuizModalOpen(open) {

    const modal =
        quizEl("coupleQuizModal");

    if (!modal) {
        return;
    }

    modal.classList.toggle(
        "hidden",
        !open
    );

    modal.setAttribute(
        "aria-hidden",
        open ? "false" : "true"
    );

    document.body.classList.toggle(
        "couple-quiz-modal-open",
        open
    );
}


function setQuizGateOpen(open) {

    const gate =
        quizEl("coupleQuizGate");

    if (!gate) {
        return;
    }

    gate.classList.toggle(
        "hidden",
        !open
    );

    gate.setAttribute(
        "aria-hidden",
        open ? "false" : "true"
    );

    document.body.classList.toggle(
        "couple-quiz-locked",
        open
    );

    document.body.style.overflow =
        open
            ? "hidden"
            : "";
}


/* =========================================================
   AUTH
========================================================= */

async function getQuizSession() {

    ensureCoupleQuizClient();

    const {
        data,
        error
    } =
        await coupleQuizSupabase.auth.getSession();

    if (error) {
        throw error;
    }

    return data?.session || null;
}


/* =========================================================
   ERROR HANDLING
========================================================= */

function getQuizErrorMessage(error) {

    const code =
        error?.code || "";

    const message =
        String(
            error?.message || ""
        );


    if (
        code === "PGRST202" ||
        code === "42883" ||
        /function .* does not exist/i.test(message)
    ) {
        return (
            "Couple Quiz database setup is incomplete. " +
            "Please check the Couple Quiz SQL."
        );
    }


    if (
        code === "42P01" ||
        /relation .*couple_quiz/i.test(message)
    ) {
        return (
            "Couple Quiz tables are missing."
        );
    }


    if (
        /authentication required/i.test(
            message
        )
    ) {
        return (
            "Your login session is not ready yet. " +
            "Please refresh the page."
        );
    }


    if (
        /already have an unanswered couple quiz question/i.test(
            message
        )
    ) {
        return (
            "You already have an unanswered Couple Quiz question. " +
            "Answer your love's question first. ❤️"
        );
    }


    return (
        message ||
        "Couldn't load Couple Quiz right now. Please try again."
    );
}


/* =========================================================
   STATE
========================================================= */

async function getCoupleQuizState() {

    ensureCoupleQuizClient();

    const {
        data,
        error
    } =
        await coupleQuizSupabase.rpc(
            "get_couple_quiz_state"
        );

    if (error) {
        throw error;
    }

    return data || {
        pending_question: null,
        my_active_question: null,
        can_add_question: true
    };
}


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeCoupleQuiz() {

    if (coupleQuizInitialized) {
        return;
    }

    coupleQuizInitialized = true;

    try {

        ensureCoupleQuizClient();

        await syncQuizSession();

        setupCoupleQuizListeners();

        setupCoupleQuizAuthListener();

        if (!coupleQuizSession) {
            return;
        }

        await refreshCoupleQuiz();

        await focusQuizNotificationHash();

    } catch (error) {

        console.error(
            "Couple Quiz initialization error:",
            error
        );

        setQuizGateOpen(false);
    }
}


async function syncQuizSession() {

    coupleQuizSession =
        await getQuizSession();

    return coupleQuizSession;
}


/* =========================================================
   REFRESH
========================================================= */

async function refreshCoupleQuiz() {

    try {

        await syncQuizSession();

        if (!coupleQuizSession) {

            coupleQuizPendingQuestion =
                null;

            setQuizGateOpen(false);

            updateQuizButton({
                pending_question: null,
                my_active_question: null
            });

            return;
        }


        const state =
            await getCoupleQuizState();


        coupleQuizPendingQuestion =
            state?.pending_question || null;


        if (coupleQuizPendingQuestion) {

            renderGateQuestion(
                coupleQuizPendingQuestion
            );

            setQuizGateOpen(true);

        } else {

            coupleQuizPendingQuestion =
                null;

            setQuizGateOpen(false);
        }


        updateQuizButton(state);

    } catch (error) {

        console.error(
            "Couple Quiz state error:",
            error
        );

        setQuizGateOpen(false);

        renderQuizUnavailableState(
            error
        );
    }
}


/* =========================================================
   BUTTON
========================================================= */

function updateQuizButton(state) {

    const button =
        quizEl(
            "openCoupleQuizButton"
        );

    if (!button) {
        return;
    }


    if (state?.pending_question) {

        button.textContent =
            "💕 Answer Your Love";

        button.classList.add(
            "quiz-button-pending"
        );

        button.title =
            "Your love has a question waiting for you.";

        return;
    }


    if (state?.my_active_question) {

        button.textContent =
            "💕 Question Pending";

        button.classList.add(
            "quiz-button-pending"
        );

        button.title =
            "Your question is waiting for your love to answer.";

        return;
    }


    button.textContent =
        "💕 Couple Quiz";

    button.classList.remove(
        "quiz-button-pending"
    );

    button.title =
        "Couple Quiz";
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupCoupleQuizListeners() {

    if (coupleQuizListenersReady) {
        return;
    }

    coupleQuizListenersReady = true;


    quizEl(
        "openCoupleQuizButton"
    )?.addEventListener(
        "click",
        async () => {
            await openQuizModal();
        }
    );


    quizEl(
        "closeCoupleQuizButton"
    )?.addEventListener(
        "click",
        () => {
            setQuizModalOpen(false);
        }
    );


    quizEl(
        "coupleQuizModal"
    )?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                quizEl("coupleQuizModal")
            ) {
                setQuizModalOpen(false);
            }
        }
    );


    quizEl(
        "submitCoupleQuizAnswerButton"
    )?.addEventListener(
        "click",
        submitCoupleQuizAnswer
    );


    quizEl(
        "coupleQuizGate"
    )?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                quizEl("coupleQuizGate")
            ) {
                event.preventDefault();
            }
        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            const gate =
                quizEl(
                    "coupleQuizGate"
                );

            if (
                gate &&
                !gate.classList.contains(
                    "hidden"
                )
            ) {
                event.preventDefault();
            }
        }
    );


    document.addEventListener(
        "visibilitychange",
        async () => {

            if (
                document.visibilityState ===
                "visible"
            ) {
                await refreshCoupleQuiz();
            }
        }
    );
}


/* =========================================================
   AUTH LISTENER
========================================================= */

function setupCoupleQuizAuthListener() {

    if (
        coupleQuizAuthListenerReady
    ) {
        return;
    }

    coupleQuizAuthListenerReady =
        true;

    ensureCoupleQuizClient();


    coupleQuizSupabase.auth
        .onAuthStateChange(
            (event, session) => {

                setTimeout(
                    async () => {

                        try {

                            coupleQuizSession =
                                session || null;


                            if (
                                !coupleQuizSession
                            ) {

                                coupleQuizPendingQuestion =
                                    null;

                                setQuizGateOpen(
                                    false
                                );

                                setQuizModalOpen(
                                    false
                                );

                                return;
                            }


                            await refreshCoupleQuiz();


                            if (
                                event ===
                                    "SIGNED_IN" ||
                                event ===
                                    "TOKEN_REFRESHED"
                            ) {

                                await focusQuizNotificationHash();
                            }

                        } catch (error) {

                            console.error(
                                "Couple Quiz auth sync error:",
                                error
                            );
                        }

                    },
                    0
                );
            }
        );
}


/* =========================================================
   RENDER GATE
========================================================= */

function renderGateQuestion(
    question
) {

    const questionElement =
        quizEl(
            "coupleQuizGateQuestion"
        );

    const optionsElement =
        quizEl(
            "coupleQuizGateOptions"
        );

    const messageElement =
        quizEl(
            "coupleQuizGateMessage"
        );

    const submitButton =
        quizEl(
            "submitCoupleQuizAnswerButton"
        );


    if (
        !questionElement ||
        !optionsElement ||
        !submitButton
    ) {
        return;
    }


    questionElement.textContent =
        question?.question_text || "";


    optionsElement.innerHTML =
        "";


    if (
        question?.question_type ===
        "text"
    ) {

        renderTextAnswerInput(
            optionsElement
        );

    } else {

        renderMcqOptions(
            question,
            optionsElement
        );
    }


    if (messageElement) {

        messageElement.textContent =
            "";

        messageElement.className =
            "couple-quiz-message";
    }


    submitButton.disabled =
        false;

    submitButton.textContent =
        "Submit Answer ❤️";
}


/* =========================================================
   MCQ OPTIONS
========================================================= */

function renderMcqOptions(
    question,
    container
) {

    const options =
        normalizeQuizOptions(
            question?.options
        );


    options.forEach(
        option => {

            const label =
                document.createElement(
                    "label"
                );

            label.className =
                "couple-quiz-option";


            const checkbox =
                document.createElement(
                    "input"
                );

            checkbox.type =
                "checkbox";

            checkbox.name =
                "coupleQuizAnswer";

            checkbox.value =
                option.id;


            const text =
                document.createElement(
                    "span"
                );

            text.textContent =
                option.text;


            label.append(
                checkbox,
                text
            );


            container.appendChild(
                label
            );


            checkbox.addEventListener(
                "change",
                () => {

                    label.classList.toggle(
                        "selected",
                        checkbox.checked
                    );
                }
            );
        }
    );
}


/* =========================================================
   TEXT ANSWER INPUT
========================================================= */

function renderTextAnswerInput(
    container
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "couple-quiz-text-answer-wrap";


    const input =
        document.createElement(
            "input"
        );

    input.type =
        "text";

    input.id =
        "coupleQuizTextAnswerInput";

    input.className =
        "couple-quiz-text-answer";

    input.name =
        "coupleQuizTextAnswer";

    input.autocomplete =
        "off";

    input.maxLength =
        100;

    input.placeholder =
        "Type your one-word answer";


    const hint =
        document.createElement(
            "p"
        );

    hint.className =
        "couple-quiz-text-hint";

    hint.textContent =
        "One word only. Capitalization doesn't matter.";


    wrapper.append(
        input,
        hint
    );


    container.appendChild(
        wrapper
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                submitCoupleQuizAnswer();
            }
        }
    );


    setTimeout(
        () => input.focus(),
        50
    );
}


/* =========================================================
   SUBMIT
========================================================= */

async function submitCoupleQuizAnswer() {

    if (
        !coupleQuizPendingQuestion
    ) {
        return;
    }


    const messageElement =
        quizEl(
            "coupleQuizGateMessage"
        );

    const submitButton =
        quizEl(
            "submitCoupleQuizAnswerButton"
        );


    const isTextQuestion =
        coupleQuizPendingQuestion
            .question_type ===
        "text";


    let selectedAnswers = [];
    let textAnswer = null;


    if (isTextQuestion) {

        const input =
            quizEl(
                "coupleQuizTextAnswerInput"
            );

        textAnswer =
            input?.value.trim() || "";


        if (!textAnswer) {

            showGateMessage(
                "Please enter your answer ❤️",
                true
            );

            input?.focus();

            return;
        }


        if (
            /\s/.test(
                textAnswer
            )
        ) {

            showGateMessage(
                "Please enter exactly one word ❤️",
                true
            );

            input?.focus();

            return;
        }

    } else {

        selectedAnswers =
            Array.from(
                document.querySelectorAll(
                    'input[name="coupleQuizAnswer"]:checked'
                )
            )
            .map(
                input =>
                    String(
                        input.value
                    )
            );


        if (
            selectedAnswers.length ===
            0
        ) {

            showGateMessage(
                "Select at least one answer ❤️",
                true
            );

            return;
        }
    }


    submitButton.disabled =
        true;

    submitButton.textContent =
        "Checking... ❤️";


    try {

        const {
            data,
            error
        } =
            await coupleQuizSupabase.rpc(
                "submit_couple_quiz_answer",
                {
                    p_question_id:
                        coupleQuizPendingQuestion.id,

                    p_selected_answers:
                        isTextQuestion
                            ? null
                            : selectedAnswers,

                    p_text_answer:
                        isTextQuestion
                            ? textAnswer
                            : null
                }
            );


        if (error) {
            throw error;
        }


        if (
            data?.correct ===
            true
        ) {

            showGateMessage(
                "Correct! You know me pretty well. ❤️",
                false
            );


            document
                .querySelectorAll(
                    'input[name="coupleQuizAnswer"], #coupleQuizTextAnswerInput'
                )
                .forEach(
                    input => {
                        input.disabled =
                            true;
                    }
                );


            submitButton.textContent =
                "Correct ❤️";


            setTimeout(
                async () => {

                    coupleQuizPendingQuestion =
                        null;

                    setQuizGateOpen(
                        false
                    );

                    await refreshCoupleQuiz();

                },
                900
            );


            return;
        }


        showGateMessage(
            "Not quite ❤️ Try again.",
            true
        );


        if (isTextQuestion) {

            const input =
                quizEl(
                    "coupleQuizTextAnswerInput"
                );

            if (input) {

                input.value =
                    "";

                input.disabled =
                    false;

                input.focus();
            }

        } else {

            document
                .querySelectorAll(
                    'input[name="coupleQuizAnswer"]'
                )
                .forEach(
                    input => {

                        input.checked =
                            false;

                        input.disabled =
                            false;
                    }
                );


            document
                .querySelectorAll(
                    ".couple-quiz-option"
                )
                .forEach(
                    option =>
                        option.classList.remove(
                            "selected"
                        )
                );
        }


        submitButton.disabled =
            false;

        submitButton.textContent =
            "Try Again ❤️";


    } catch (error) {

        console.error(
            "Couple Quiz answer error:",
            error
        );


        showGateMessage(
            getQuizErrorMessage(
                error
            ),
            true
        );


        submitButton.disabled =
            false;

        submitButton.textContent =
            "Submit Answer ❤️";
    }
}


/* =========================================================
   MESSAGE
========================================================= */

function showGateMessage(
    message,
    isError
) {

    const element =
        quizEl(
            "coupleQuizGateMessage"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.className =
        `couple-quiz-message ${
            isError
                ? "error"
                : "success"
        }`;
}


/* =========================================================
   MODAL
========================================================= */

async function openQuizModal(
    questionId = null
) {

    const body =
        quizEl(
            "coupleQuizModalBody"
        );

    if (!body) {
        return;
    }


    setQuizModalOpen(
        true
    );


    body.innerHTML = `
        <div class="couple-quiz-loading">
            Loading...
        </div>
    `;


    try {

        const state =
            await getCoupleQuizState();


        updateQuizButton(
            state
        );


        /*
         * Partner's question always
         * gets priority.
         */

        if (
            state?.pending_question
        ) {

            renderModalAnswerQuestion(
                state.pending_question
            );

            return;
        }


        if (
            state?.my_active_question
        ) {

            renderOwnPendingQuestion(
                state.my_active_question
            );

            return;
        }


        if (questionId) {

            const opened =
                await openQuizQuestionFromNotification(
                    questionId,
                    false
                );

            if (opened) {
                return;
            }
        }


        renderCreateQuestionForm();


    } catch (error) {

        console.error(
            "Open Couple Quiz error:",
            error
        );


        body.innerHTML = `
            <div class="couple-quiz-message error">
                ${quizEscape(
                    getQuizErrorMessage(error)
                )}
            </div>
        `;
    }
}


/* =========================================================
   MODAL ANSWER
========================================================= */

function renderModalAnswerQuestion(
    question
) {

    const body =
        quizEl(
            "coupleQuizModalBody"
        );

    if (!body) {
        return;
    }


    const isText =
        question?.question_type ===
        "text";


    body.innerHTML = `
        <div class="couple-quiz-form">

            <div class="quiz-status-icon">
                💕
            </div>

            <h3>
                Your love has a question for you ❤️
            </h3>

            <div class="quiz-own-question">
                ${quizEscape(
                    question?.question_text
                )}
            </div>

            ${
                isText
                    ? `
                        <p class="couple-quiz-form-intro">
                            Answer using one word.
                            Capitalization doesn't matter.
                        </p>

                        <input
                            id="coupleQuizModalTextAnswer"
                            class="couple-quiz-text-answer"
                            type="text"
                            maxlength="100"
                            autocomplete="off"
                            placeholder="Your answer"
                        >
                    `
                    : `
                        <p class="couple-quiz-form-intro">
                            Choose every answer you think is correct.
                        </p>

                        <div
                            id="coupleQuizModalAnswerOptions"
                            class="couple-quiz-options"
                        ></div>
                    `
            }

            <p
                id="coupleQuizModalAnswerMessage"
                class="couple-quiz-message"
                aria-live="polite"
            ></p>

            <button
                id="coupleQuizModalSubmitAnswerButton"
                class="primary-button full-width"
                type="button"
            >
                Submit Answer ❤️
            </button>

        </div>
    `;


    const messageElement =
        quizEl(
            "coupleQuizModalAnswerMessage"
        );

    const submitButton =
        quizEl(
            "coupleQuizModalSubmitAnswerButton"
        );


    if (isText) {

        const input =
            quizEl(
                "coupleQuizModalTextAnswer"
            );


        input?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    submitModalAnswer(
                        question
                    );
                }
            }
        );


        setTimeout(
            () =>
                input?.focus(),
            50
        );

    } else {

        const optionsElement =
            quizEl(
                "coupleQuizModalAnswerOptions"
            );


        normalizeQuizOptions(
            question?.options
        )
        .forEach(
            option => {

                const label =
                    document.createElement(
                        "label"
                    );

                label.className =
                    "couple-quiz-option";


                const checkbox =
                    document.createElement(
                        "input"
                    );

                checkbox.type =
                    "checkbox";

                checkbox.name =
                    "coupleQuizModalAnswer";

                checkbox.value =
                    option.id;


                const text =
                    document.createElement(
                        "span"
                    );

                text.textContent =
                    option.text;


                label.append(
                    checkbox,
                    text
                );


                optionsElement.appendChild(
                    label
                );


                checkbox.addEventListener(
                    "change",
                    () => {

                        label.classList.toggle(
                            "selected",
                            checkbox.checked
                        );
                    }
                );
            }
        );
    }


    submitButton?.addEventListener(
        "click",
        () =>
            submitModalAnswer(
                question
            )
    );
}


/* =========================================================
   MODAL SUBMIT
========================================================= */

async function submitModalAnswer(
    question
) {

    const messageElement =
        quizEl(
            "coupleQuizModalAnswerMessage"
        );

    const submitButton =
        quizEl(
            "coupleQuizModalSubmitAnswerButton"
        );


    const isText =
        question?.question_type ===
        "text";


    let selected =
        [];

    let textAnswer =
        null;


    if (isText) {

        const input =
            quizEl(
                "coupleQuizModalTextAnswer"
            );

        textAnswer =
            input?.value.trim() || "";


        if (!textAnswer) {

            messageElement.textContent =
                "Please enter your answer ❤️";

            messageElement.className =
                "couple-quiz-message error";

            input?.focus();

            return;
        }


        if (
            /\s/.test(
                textAnswer
            )
        ) {

            messageElement.textContent =
                "Please enter exactly one word ❤️";

            messageElement.className =
                "couple-quiz-message error";

            input?.focus();

            return;
        }

    } else {

        selected =
            Array.from(
                document.querySelectorAll(
                    'input[name="coupleQuizModalAnswer"]:checked'
                )
            )
            .map(
                input =>
                    String(
                        input.value
                    )
            );


        if (!selected.length) {

            messageElement.textContent =
                "Select at least one answer ❤️";

            messageElement.className =
                "couple-quiz-message error";

            return;
        }
    }


    submitButton.disabled =
        true;

    submitButton.textContent =
        "Checking... ❤️";


    try {

        const {
            data,
            error
        } =
            await coupleQuizSupabase.rpc(
                "submit_couple_quiz_answer",
                {
                    p_question_id:
                        question.id,

                    p_selected_answers:
                        isText
                            ? null
                            : selected,

                    p_text_answer:
                        isText
                            ? textAnswer
                            : null
                }
            );


        if (error) {
            throw error;
        }


        if (
            data?.correct ===
            true
        ) {

            messageElement.textContent =
                "Correct! You know me pretty well. ❤️";

            messageElement.className =
                "couple-quiz-message success";


            submitButton.textContent =
                "Correct ❤️";


            setTimeout(
                async () => {

                    setQuizModalOpen(
                        false
                    );

                    coupleQuizPendingQuestion =
                        null;

                    await refreshCoupleQuiz();

                },
                900
            );


            return;
        }


        messageElement.textContent =
            "Not quite ❤️ Try again.";

        messageElement.className =
            "couple-quiz-message error";


        if (isText) {

            const input =
                quizEl(
                    "coupleQuizModalTextAnswer"
                );

            input.value =
                "";

            input.disabled =
                false;

            input.focus();

        } else {

            document
                .querySelectorAll(
                    'input[name="coupleQuizModalAnswer"]'
                )
                .forEach(
                    input => {

                        input.checked =
                            false;

                        input.disabled =
                            false;
                    }
                );


            document
                .querySelectorAll(
                    "#coupleQuizModalAnswerOptions .couple-quiz-option"
                )
                .forEach(
                    option =>
                        option.classList.remove(
                            "selected"
                        )
                );
        }


        submitButton.disabled =
            false;

        submitButton.textContent =
            "Try Again ❤️";


    } catch (error) {

        console.error(
            "Couple Quiz modal answer error:",
            error
        );


        messageElement.textContent =
            getQuizErrorMessage(
                error
            );

        messageElement.className =
            "couple-quiz-message error";


        submitButton.disabled =
            false;

        submitButton.textContent =
            "Submit Answer ❤️";
    }
}


/* =========================================================
   OWN QUESTION
========================================================= */

function renderOwnPendingQuestion(
    question
) {

    const body =
        quizEl(
            "coupleQuizModalBody"
        );

    if (!body) {
        return;
    }


    const typeLabel =
        question?.question_type ===
        "text"
            ? "One-word answer"
            : "Multiple choice";


    body.innerHTML = `

        <div class="quiz-status-card">

            <div class="quiz-status-icon">
                ⏳
            </div>

            <h3>
                Your question is waiting ❤️
            </h3>

            <p>
                Once your love answers it correctly,
                you'll be able to add another question.
            </p>

            <div class="quiz-own-question">
                ${quizEscape(
                    question?.question_text
                )}
            </div>

            <span class="couple-quiz-type-badge">
                ${typeLabel}
            </span>

            <button
                id="refreshCoupleQuizStatus"
                class="primary-button full-width"
                type="button"
            >
                Check Again
            </button>

        </div>
    `;


    quizEl(
        "refreshCoupleQuizStatus"
    )?.addEventListener(
        "click",
        async () => {

            await openQuizModal();
        }
    );
}


/* =========================================================
   CREATE QUESTION FORM
========================================================= */

function renderCreateQuestionForm() {

    const body =
        quizEl("coupleQuizModalBody");

    if (!body) {
        return;
    }

    body.innerHTML = `

        <div class="couple-quiz-form">

            <div class="quiz-status-icon">
                💕
            </div>

            <h3>
                Ask Your Love
            </h3>

            <p class="couple-quiz-form-intro">
                Ask something only the two of you would know. ❤️
            </p>

            <label for="coupleQuizQuestionType">
                Question type
            </label>

            <select
                id="coupleQuizQuestionType"
                class="couple-quiz-question-type"
            >
                <option value="mcq">
                    Multiple Choice
                </option>

                <option value="text">
                    One Word Answer
                </option>
            </select>

            <label for="coupleQuizQuestionInput">
                Your question
            </label>

            <textarea
                id="coupleQuizQuestionInput"
                maxlength="500"
                rows="4"
                placeholder="What was the first place we visited together?"
            ></textarea>


            <!-- ================================
                 MULTIPLE CHOICE FORM
            ================================= -->

            <div
                id="coupleQuizMcqCreator"
                class="couple-quiz-create-section"
            >

                <div class="couple-quiz-form-label">
                    Answers
                    <span>
                        Tick every correct answer.
                    </span>
                </div>

                ${renderCreateOption("A")}
                ${renderCreateOption("B")}
                ${renderCreateOption("C")}
                ${renderCreateOption("D")}

            </div>


            <!-- ================================
                 ONE WORD FORM
            ================================= -->

            <div
                id="coupleQuizTextCreator"
                class="couple-quiz-create-section"
                hidden
            >

                <div class="couple-quiz-form-label">
                    Correct answer
                    <span>
                        One word only. Case doesn't matter.
                    </span>
                </div>

                <input
                    id="coupleQuizCorrectTextAnswer"
                    class="couple-quiz-text-answer"
                    type="text"
                    maxlength="100"
                    autocomplete="off"
                    placeholder="e.g. Blue"
                >

            </div>


            <p
                id="coupleQuizCreateMessage"
                class="couple-quiz-message"
                aria-live="polite"
            ></p>


            <button
                id="createCoupleQuizButton"
                class="primary-button full-width"
                type="button"
            >
                Ask My Love ❤️
            </button>

        </div>
    `;


    const typeSelect =
        quizEl("coupleQuizQuestionType");


    typeSelect?.addEventListener(
        "change",
        updateQuestionCreatorType
    );


    quizEl(
        "createCoupleQuizButton"
    )?.addEventListener(
        "click",
        createCoupleQuizQuestion
    );


    // Make sure the correct form is shown initially.
    updateQuestionCreatorType();
}


function updateQuestionCreatorType() {

    const type =
        quizEl(
            "coupleQuizQuestionType"
        )?.value || "mcq";


    const mcqCreator =
        quizEl(
            "coupleQuizMcqCreator"
        );

    const textCreator =
        quizEl(
            "coupleQuizTextCreator"
        );


    if (!mcqCreator || !textCreator) {
        return;
    }


    if (type === "mcq") {

        // Show MCQ form
        mcqCreator.hidden = false;

        // Hide One Word form
        textCreator.hidden = true;

    } else {

        // Hide MCQ form
        mcqCreator.hidden = true;

        // Show One Word form
        textCreator.hidden = false;
    }
}

function renderCreateOption(
    key
) {

    return `

        <div class="couple-quiz-create-option">

            <input
                id="coupleQuizCorrect${key}"
                type="checkbox"
                value="${key}"
                class="couple-quiz-correct"
            >

            <input
                id="coupleQuizOption${key}"
                type="text"
                maxlength="200"
                placeholder="Option ${key}"
            >

        </div>
    `;
}


/* =========================================================
   CREATE QUESTION
========================================================= */

async function createCoupleQuizQuestion() {

    const questionInput =
        quizEl(
            "coupleQuizQuestionInput"
        );

    const typeInput =
        quizEl(
            "coupleQuizQuestionType"
        );

    const button =
        quizEl(
            "createCoupleQuizButton"
        );


    const questionText =
        questionInput?.value.trim() || "";


    const questionType =
        typeInput?.value || "mcq";


    if (!questionText) {

        showQuizCreateMessage(
            "Please enter a question ❤️",
            true
        );

        return;
    }


    let options = {};
    let correctAnswers = [];
    let correctTextAnswer = null;


    /* =====================================================
       MCQ
    ===================================================== */

    if (
        questionType ===
        "mcq"
    ) {

        ["A", "B", "C", "D"]
            .forEach(
                key => {

                    const input =
                        quizEl(
                            `coupleQuizOption${key}`
                        );

                    const value =
                        input?.value.trim() ||
                        "";

                    if (value) {
                        options[key] =
                            value;
                    }
                }
            );


        if (
            Object.keys(options)
                .length < 2
        ) {

            showQuizCreateMessage(
                "Please provide at least two options.",
                true
            );

            return;
        }


        correctAnswers =
            Array.from(
                document.querySelectorAll(
                    ".couple-quiz-correct:checked"
                )
            )
            .map(
                checkbox =>
                    checkbox.value
            )
            .filter(
                key =>
                    Object.prototype.hasOwnProperty.call(
                        options,
                        key
                    )
            );


        if (
            !correctAnswers.length
        ) {

            showQuizCreateMessage(
                "Select at least one correct answer.",
                true
            );

            return;
        }
    }


    /* =====================================================
       TEXT
    ===================================================== */

    else {

        correctTextAnswer =
            quizEl(
                "coupleQuizCorrectTextAnswer"
            )?.value.trim() || "";


        if (!correctTextAnswer) {

            showQuizCreateMessage(
                "Please enter the correct answer.",
                true
            );

            return;
        }


        if (
            /\s/.test(
                correctTextAnswer
            )
        ) {

            showQuizCreateMessage(
                "The correct answer must contain exactly one word.",
                true
            );

            return;
        }
    }


    button.disabled =
        true;

    button.textContent =
        "Sending... ❤️";


    try {

        const {
            data,
            error
        } =
            await coupleQuizSupabase.rpc(
                "create_couple_quiz_question",
                {
                    p_question_text:
                        questionText,

                    p_question_type:
                        questionType,

                    p_options:
                        questionType ===
                        "mcq"
                            ? options
                            : [],

                    p_correct_option_ids:
                        questionType ===
                        "mcq"
                            ? correctAnswers
                            : [],

                    p_correct_text_answer:
                        questionType ===
                        "text"
                            ? correctTextAnswer
                            : null
                }
            );


        if (error) {
            throw error;
        }


        console.log(
            "Couple Quiz question created:",
            data
        );


        showQuizCreateMessage(
            "Your question is waiting for your love ❤️",
            false
        );


        setTimeout(
            async () => {

                setQuizModalOpen(
                    false
                );

                await refreshCoupleQuiz();

            },
            800
        );


    } catch (error) {

        console.error(
            "Create Couple Quiz error:",
            error
        );


        showQuizCreateMessage(
            getQuizErrorMessage(
                error
            ),
            true
        );


        button.disabled =
            false;

        button.textContent =
            "Ask My Love ❤️";
    }
}


function showQuizCreateMessage(
    message,
    isError
) {

    const element =
        quizEl(
            "coupleQuizCreateMessage"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.className =
        `couple-quiz-message ${
            isError
                ? "error"
                : "success"
        }`;
}


/* =========================================================
   UNAVAILABLE
========================================================= */

function renderQuizUnavailableState(
    error = null
) {

    const button =
        quizEl(
            "openCoupleQuizButton"
        );

    if (!button) {
        return;
    }

    button.classList.remove(
        "quiz-button-pending"
    );

    button.textContent =
        "💕 Couple Quiz";

    button.title =
        error
            ? getQuizErrorMessage(
                error
            )
            : "Couple Quiz";
}


/* =========================================================
   NOTIFICATION NAVIGATION
========================================================= */

async function focusQuizNotificationHash() {

    const hash =
        window.location.hash ||
        "";

    const prefix =
        "#quiz-question-";


    if (
        !hash.startsWith(
            prefix
        )
    ) {
        return;
    }


    const questionId =
        hash.substring(
            prefix.length
        );


    if (!questionId) {
        return;
    }


    quizEl(
        "openCoupleQuizButton"
    )?.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });


    await openQuizQuestionFromNotification(
        questionId,
        true
    );


    history.replaceState(
        null,
        "",
        window.location.pathname +
        window.location.search
    );
}


async function openQuizQuestionFromNotification(
    questionId,
    showModal = true
) {

    const body =
        quizEl(
            "coupleQuizModalBody"
        );

    if (!body) {
        return false;
    }


    if (showModal) {
        setQuizModalOpen(true);
    }


    body.innerHTML = `
        <div class="couple-quiz-loading">
            Loading question...
        </div>
    `;


    try {

        const state =
            await getCoupleQuizState();


        const pending =
            state?.pending_question ||
            null;


        if (
            pending &&
            String(pending.id) ===
            String(questionId)
        ) {

            renderModalAnswerQuestion(
                pending
            );

            return true;
        }


        const {
            data: question,
            error
        } =
            await coupleQuizSupabase
                .from(
                    "couple_quiz_questions"
                )
                .select(
                    "id, question_text, question_type, options, question_date, created_by, is_active, is_answered, answered_at, answered_by"
                )
                .eq(
                    "id",
                    questionId
                )
                .maybeSingle();


        if (error) {
            throw error;
        }


        if (!question) {

            body.innerHTML = `
                <div class="couple-quiz-message">
                    This question is no longer available. ❤️
                </div>
            `;

            return false;
        }


        body.innerHTML = `

            <div class="quiz-status-card">

                <div class="quiz-status-icon">
                    ${
                        question.is_answered
                            ? "💕"
                            : "⏳"
                    }
                </div>

                <h3>
                    Couple Quiz Question
                </h3>

                <div class="quiz-own-question">
                    ${quizEscape(
                        question.question_text
                    )}
                </div>

                <p>
                    ${
                        question.is_answered
                            ? "This question has been answered correctly. ❤️"
                            : "This question is still waiting for an answer. ❤️"
                    }
                </p>

            </div>
        `;


        return true;


    } catch (error) {

        console.error(
            "Quiz notification navigation error:",
            error
        );


        body.innerHTML = `

            <div class="couple-quiz-message error">

                ${quizEscape(
                    getQuizErrorMessage(
                        error
                    )
                )}

            </div>
        `;


        return false;
    }
}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeCoupleQuiz
);