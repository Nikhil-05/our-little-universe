let coupleQuizSupabase = null;
let coupleQuizSession = null;
let coupleQuizPendingQuestion = null;
let coupleQuizInitialized = false;
let coupleQuizListenersReady = false;
let coupleQuizAuthListenerReady = false;


/* =========================================================
   SUPABASE CLIENT
   ========================================================= */

function ensureCoupleQuizClient() {
    if (coupleQuizSupabase) return coupleQuizSupabase;

    if (!window.supabase?.createClient) {
        throw new Error("Supabase client library is not loaded.");
    }

    if (
        typeof SUPABASE_URL === "undefined" ||
        typeof SUPABASE_KEY === "undefined"
    ) {
        throw new Error("Supabase configuration is not loaded.");
    }

    coupleQuizSupabase = window.supabase.createClient(
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
    const div = document.createElement("div");

    div.textContent =
        value == null ? "" : String(value);

    return div.innerHTML;
}


/* =========================================================
   MODAL / GATE
   ========================================================= */

function setQuizModalOpen(open) {
    const modal = quizEl("coupleQuizModal");

    if (!modal) return;

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
    const gate = quizEl("coupleQuizGate");

    if (!gate) return;

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
        open ? "hidden" : "";
}


/* =========================================================
   AUTH
   ========================================================= */

async function getQuizSession() {
    ensureCoupleQuizClient();

    const {
        data,
        error
    } = await coupleQuizSupabase.auth.getSession();

    if (error) {
        throw error;
    }

    return data?.session || null;
}


async function syncQuizSession() {
    coupleQuizSession =
        await getQuizSession();

    return coupleQuizSession;
}


/* =========================================================
   ERROR HANDLING
   ========================================================= */

function getQuizErrorMessage(error) {
    const code =
        error?.code || "";

    const message =
        String(error?.message || "");


    if (
        code === "PGRST202" ||
        code === "42883" ||
        /get_couple_quiz_state/i.test(message) ||
        /function .* does not exist/i.test(message)
    ) {
        return "Couple Quiz database setup is missing. Please check the Couple Quiz SQL functions in Supabase.";
    }


    if (
        code === "42P01" ||
        /relation .*couple_quiz/i.test(message)
    ) {
        return "Couple Quiz tables are missing. Please check the Couple Quiz database setup.";
    }


    if (
        /authentication required/i.test(message)
    ) {
        return "Your login session is not ready yet. Please refresh the page.";
    }


    if (
        /p_correct_answers/i.test(message)
    ) {
        return "Couple Quiz configuration mismatch. The question creation function expects p_correct_option_ids.";
    }


    if (
        /already have an unanswered couple quiz question/i.test(message)
    ) {
        return "You already have an unanswered Couple Quiz question. Answer your love's question first. ❤️";
    }


    return (
        message ||
        "Couldn't load Couple Quiz right now. Please try again."
    );
}


/* =========================================================
   GET QUIZ STATE
   ========================================================= */

async function getCoupleQuizState() {
    ensureCoupleQuizClient();

    const {
        data,
        error
    } = await coupleQuizSupabase.rpc(
        "get_couple_quiz_state"
    );

    if (error) {
        throw error;
    }

    const state = data || {};

    let pendingQuestion = null;
    let myActiveQuestion = null;


    /*
     * =========================================================
     * PARTNER QUESTION
     *
     * get_couple_quiz_state() gives us the question ID.
     * The existing get_couple_quiz_question RPC does NOT
     * accept p_question_id, so fetch the row directly.
     * =========================================================
     */

    if (
        state.partner_question_id &&
        state.must_answer_question === true
    ) {

        const {
            data: partnerQuestion,
            error: partnerQuestionError
        } =
            await coupleQuizSupabase
                .from("couple_quiz_questions")
                .select(
                    "id, question_text, options, question_date, created_by, is_active, is_answered, answered_at, answered_by"
                )
                .eq(
                    "id",
                    state.partner_question_id
                )
                .maybeSingle();

        if (partnerQuestionError) {
            console.error(
                "[COUPLE QUIZ] Failed to load partner question:",
                partnerQuestionError
            );

            throw partnerQuestionError;
        }

        pendingQuestion =
            partnerQuestion || null;
    }


    /*
     * =========================================================
     * MY QUESTION
     * =========================================================
     */

    if (
        state.my_question_id &&
        state.has_my_unanswered_question === true
    ) {

        const {
            data: ownQuestion,
            error: ownQuestionError
        } =
            await coupleQuizSupabase
                .from("couple_quiz_questions")
                .select(
                    "id, question_text, options, question_date, created_by, is_active, is_answered, answered_at, answered_by"
                )
                .eq(
                    "id",
                    state.my_question_id
                )
                .maybeSingle();

        if (ownQuestionError) {
            console.error(
                "[COUPLE QUIZ] Failed to load own question:",
                ownQuestionError
            );

            throw ownQuestionError;
        }

        myActiveQuestion =
            ownQuestion || null;
    }


    /*
     * =========================================================
     * RETURN NORMALIZED STATE
     * =========================================================
     */

    return {
        ...state,

        pending_question:
            pendingQuestion,

        my_active_question:
            myActiveQuestion
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

        closeQuizGateSafely();
    }
}


/* =========================================================
   REFRESH QUIZ
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


        /*
         * VERY IMPORTANT:
         *
         * pending_question belongs to the
         * CURRENT USER and must always take
         * priority over my_active_question.
         */

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
   QUIZ BUTTON
   ========================================================= */

function updateQuizButton(state) {

    const button =
        quizEl(
            "openCoupleQuizButton"
        );

    if (!button) {
        return;
    }


    /*
     * Partner's question has priority.
     */

    if (
        state?.pending_question
    ) {

        button.textContent =
            "💕 Answer Your Love";

        button.classList.add(
            "quiz-button-pending"
        );

        button.title =
            "Your love has a question waiting for you.";

        return;
    }


    /*
     * Own question is waiting
     * for partner.
     */

    if (
        state?.my_active_question
    ) {

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
                quizEl(
                    "coupleQuizModal"
                )
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
                quizEl(
                    "coupleQuizGate"
                )
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
   AUTH STATE LISTENER
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


    coupleQuizSupabase.auth.onAuthStateChange(
        (
            event,
            session
        ) => {

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

                            updateQuizButton({
                                pending_question: null,
                                my_active_question: null
                            });

                            return;
                        }


                        await refreshCoupleQuiz();


                        if (
                            event === "SIGNED_IN" ||
                            event === "TOKEN_REFRESHED"
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
   RENDER GATE QUESTION
   ========================================================= */

function renderGateQuestion(question) {
    const questionElement =
        quizEl("coupleQuizGateQuestion");

    const optionsElement =
        quizEl("coupleQuizGateOptions");

    const messageElement =
        quizEl("coupleQuizGateMessage");

    const submitButton =
        quizEl("submitCoupleQuizAnswerButton");

    if (
        !questionElement ||
        !optionsElement ||
        !submitButton
    ) {
        return;
    }

    questionElement.textContent =
        question?.question_text || "";

    optionsElement.innerHTML = "";

    const rawOptions =
        question?.options || [];

    /*
     * IMPORTANT:
     *
     * Supabase currently stores options like:
     *
     * [
     *   { id: "A", text: "test1" },
     *   { id: "B", text: "test2" },
     *   { id: "C", text: "test3" },
     *   { id: "D", text: "test4" }
     * ]
     *
     * Older questions may also use:
     *
     * {
     *   A: "test1",
     *   B: "test2",
     *   C: "test3",
     *   D: "test4"
     * }
     *
     * Normalize both formats here.
     */

    let normalizedOptions = [];

    if (Array.isArray(rawOptions)) {

        normalizedOptions =
            rawOptions
                .map(option => {

                    if (
                        option &&
                        typeof option === "object"
                    ) {
                        return {
                            id: String(
                                option.id ?? ""
                            ),
                            text: String(
                                option.text ?? ""
                            )
                        };
                    }

                    return null;
                })
                .filter(
                    option =>
                        option &&
                        option.id &&
                        option.text
                );

    } else if (
        rawOptions &&
        typeof rawOptions === "object"
    ) {

        normalizedOptions =
            Object.entries(rawOptions)
                .map(
                    ([id, text]) => ({
                        id: String(id),
                        text: String(text)
                    })
                );
    }

    normalizedOptions.forEach(
        ({ id, text }) => {

            const label =
                document.createElement("label");

            label.className =
                "couple-quiz-option";

            const checkbox =
                document.createElement("input");

            checkbox.type =
                "checkbox";

            checkbox.name =
                "coupleQuizAnswer";

            /*
             * THIS IS THE IMPORTANT PART.
             *
             * Send the actual option ID:
             *
             * B
             * D
             *
             * instead of array indexes:
             *
             * 1
             * 3
             */
            checkbox.value =
                id;

            const textElement =
                document.createElement("span");

            textElement.textContent =
                text;

            label.append(
                checkbox,
                textElement
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
   GET SELECTED ANSWERS
   ========================================================= */

function getSelectedQuizAnswers(
    container = document
) {

    return Array.from(
        container.querySelectorAll(
            'input[name="coupleQuizAnswer"]:checked'
        )
    ).map(
        input => input.value
    );
}


/* =========================================================
   SUBMIT GATE ANSWER
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


    const selected =
        getSelectedQuizAnswers();


    if (
        !selected.length
    ) {

        if (messageElement) {

            messageElement.textContent =
                "Select at least one answer ❤️";

            messageElement.className =
                "couple-quiz-message error";
        }

        return;
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
                        selected
                }
            );


        if (error) {
            throw error;
        }


        if (
            data?.correct === true
        ) {

            if (messageElement) {

                messageElement.textContent =
                    "Correct! You know me pretty well. ❤️";

                messageElement.className =
                    "couple-quiz-message success";
            }


            document
                .querySelectorAll(
                    'input[name="coupleQuizAnswer"]'
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


        /*
         * WRONG ANSWER
         */

        if (messageElement) {

            messageElement.textContent =
                "Not quite ❤️ Try again.";

            messageElement.className =
                "couple-quiz-message error";
        }


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
                option => {

                    option.classList.remove(
                        "selected"
                    );
                }
            );


        submitButton.disabled =
            false;

        submitButton.textContent =
            "Try Again ❤️";

    } catch (error) {

        console.error(
            "Couple Quiz answer error:",
            error
        );


        if (messageElement) {

            messageElement.textContent =
                getQuizErrorMessage(
                    error
                );

            messageElement.className =
                "couple-quiz-message error";
        }


        submitButton.disabled =
            false;

        submitButton.textContent =
            "Submit Answer ❤️";
    }
}


/* =========================================================
   OPEN QUIZ MODAL
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
         * IMPORTANT:
         *
         * If this user has a question
         * waiting from their partner,
         * ALWAYS show that first.
         */

        if (
            state?.pending_question
        ) {

            coupleQuizPendingQuestion =
                state.pending_question;

            renderModalAnswerQuestion(
                state.pending_question
            );

            return;
        }


        coupleQuizPendingQuestion =
            null;


        /*
         * If our own question is waiting
         * for the partner, show its status.
         */

        if (
            state?.my_active_question
        ) {

            renderOwnPendingQuestion(
                state.my_active_question
            );

            return;
        }


        /*
         * Notification supplied a question ID.
         */

        if (
            questionId
        ) {

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
                    getQuizErrorMessage(
                        error
                    )
                )}
            </div>
        `;
    }
}


/* =========================================================
   MODAL ANSWER QUESTION
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


    const options =
        question?.options || {};


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

            <p class="couple-quiz-form-intro">
                Choose every answer you think is correct.
            </p>

            <div
                id="coupleQuizModalAnswerOptions"
                class="couple-quiz-options"
            ></div>

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


    const optionsElement =
        quizEl(
            "coupleQuizModalAnswerOptions"
        );

    const messageElement =
        quizEl(
            "coupleQuizModalAnswerMessage"
        );

    const submitButton =
        quizEl(
            "coupleQuizModalSubmitAnswerButton"
        );


    Object.entries(
        options
    ).forEach(
        ([key, value]) => {

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
                key;


            const text =
                document.createElement(
                    "span"
                );

            text.textContent =
                value;


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


    submitButton.addEventListener(
        "click",
        async () => {

            const selected =
    Array.from(
        document.querySelectorAll(
            'input[name="coupleQuizAnswer"]:checked'
        )
    )
    .map(
        input =>
            String(input.value)
    );


            if (
                !selected.length
            ) {

                messageElement.textContent =
                    "Select at least one answer ❤️";

                messageElement.className =
                    "couple-quiz-message error";

                return;
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
                                selected
                        }
                    );


                if (error) {
                    throw error;
                }


                if (
                    data?.correct === true
                ) {

                    messageElement.textContent =
                        "Correct! You know me pretty well. ❤️";

                    messageElement.className =
                        "couple-quiz-message success";


                    optionsElement
                        .querySelectorAll(
                            "input"
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


                /*
                 * WRONG ANSWER
                 */

                messageElement.textContent =
                    "Not quite ❤️ Try again.";

                messageElement.className =
                    "couple-quiz-message error";


                optionsElement
                    .querySelectorAll(
                        "input"
                    )
                    .forEach(
                        input => {

                            input.checked =
                                false;

                            input.disabled =
                                false;
                        }
                    );


                optionsElement
                    .querySelectorAll(
                        ".couple-quiz-option"
                    )
                    .forEach(
                        option => {

                            option.classList.remove(
                                "selected"
                            );
                        }
                    );


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
    );
}


/* =========================================================
   OWN QUESTION PENDING
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
        quizEl(
            "coupleQuizModalBody"
        );


    if (!body) {
        return;
    }


    body.innerHTML = `
        <div class="couple-quiz-form">

            <p class="couple-quiz-form-intro">
                Ask something only the two of you would know. ❤️
            </p>

            <label
                for="coupleQuizQuestionInput"
            >
                Your question
            </label>

            <textarea
                id="coupleQuizQuestionInput"
                maxlength="500"
                rows="4"
                placeholder="What was the first place we visited together?"
            ></textarea>

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


    quizEl(
        "createCoupleQuizButton"
    )?.addEventListener(
        "click",
        createCoupleQuizQuestion
    );
}


/* =========================================================
   CREATE OPTIONS
   ========================================================= */

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

    const button =
        quizEl(
            "createCoupleQuizButton"
        );


    const questionText =
        questionInput?.value.trim() ||
        "";


    if (!questionText) {

        showQuizCreateMessage(
            "Please enter a question ❤️",
            true
        );

        return;
    }


    const options = {};


    [
        "A",
        "B",
        "C",
        "D"
    ].forEach(
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
        Object.keys(
            options
        ).length < 2
    ) {

        showQuizCreateMessage(
            "Please provide at least two options.",
            true
        );

        return;
    }


    const correctAnswers =
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

                    p_options:
                        options,

                    p_correct_option_ids:
                        correctAnswers
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


/* =========================================================
   CREATE MESSAGE
   ========================================================= */

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
            ? getQuizErrorMessage(error)
            : "Couple Quiz";
}


/* =========================================================
   NOTIFICATION HASH
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


/* =========================================================
   OPEN QUESTION FROM NOTIFICATION
   ========================================================= */

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

        /*
         * FIRST:
         *
         * Get the authoritative quiz state.
         *
         * If this notification belongs to the
         * question currently waiting for THIS USER,
         * render the actual answer interface.
         */

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

            coupleQuizPendingQuestion =
                pending;


            renderModalAnswerQuestion(
                pending
            );


            return true;
        }


        /*
         * Otherwise fetch the notification's
         * question directly.
         */

        const {
            data: question,
            error: questionError
        } =
            await coupleQuizSupabase
                .from(
                    "couple_quiz_questions"
                )
                .select(
                    "id, question_text, options, question_date, created_by, is_active, is_answered, answered_at, answered_by"
                )
                .eq(
                    "id",
                    questionId
                )
                .maybeSingle();


        if (questionError) {
            throw questionError;
        }


        if (!question) {

            body.innerHTML = `
                <div class="couple-quiz-message">
                    This question is no longer available. ❤️
                </div>
            `;

            return false;
        }


        /*
         * Question exists but is not currently
         * the pending question for this user.
         */

        if (
            !question.is_answered
        ) {

            body.innerHTML = `
                <div class="quiz-status-card">

                    <div class="quiz-status-icon">
                        ⏳
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
                        This question is still waiting for an answer. ❤️
                    </p>

                    <p class="couple-quiz-notification-status">
                        Open Couple Quiz to continue.
                    </p>

                </div>
            `;

        } else {

            body.innerHTML = `
                <div class="quiz-status-card">

                    <div class="quiz-status-icon">
                        💕
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
                        This question has been answered correctly. ❤️
                    </p>

                </div>
            `;
        }


        return true;


    } catch (error) {

        console.error(
            "Quiz notification navigation error:",
            error
        );


        /*
         * FALLBACK
         *
         * Your existing zero-argument RPC.
         */

        try {

            const {
                data,
                error: rpcError
            } =
                await coupleQuizSupabase.rpc(
                    "get_couple_quiz_question"
                );


            if (rpcError) {
                throw rpcError;
            }


            if (!data) {

                body.innerHTML = `
                    <div class="couple-quiz-message">
                        This question is no longer active. ❤️
                    </div>
                `;

                return false;
            }


            if (
                data.id &&
                String(data.id) !==
                String(questionId)
            ) {

                body.innerHTML = `
                    <div class="couple-quiz-message">
                        This question is no longer the active Couple Quiz question. ❤️
                    </div>
                `;

                return false;
            }


            const state =
                await getCoupleQuizState()
                    .catch(
                        () => null
                    );


            if (
                state?.pending_question &&
                String(
                    state.pending_question.id
                ) ===
                String(questionId)
            ) {

                coupleQuizPendingQuestion =
                    state.pending_question;


                renderModalAnswerQuestion(
                    state.pending_question
                );


                return true;
            }


            body.innerHTML = `
                <div class="quiz-status-card">

                    <div class="quiz-status-icon">
                        💕
                    </div>

                    <h3>
                        Couple Quiz Question
                    </h3>

                    <div class="quiz-own-question">
                        ${quizEscape(
                            data.question_text
                        )}
                    </div>

                    <p>
                        ${
                            data.is_answered
                                ? "This question has been answered correctly. ❤️"
                                : "This question is still waiting for an answer. ⏳"
                        }
                    </p>

                </div>
            `;


            return true;


        } catch (
            fallbackError
        ) {

            console.error(
                "Couple Quiz notification fallback error:",
                fallbackError
            );


            body.innerHTML = `
                <div class="couple-quiz-message error">
                    ${quizEscape(
                        getQuizErrorMessage(
                            fallbackError
                        )
                    )}
                </div>
            `;


            return false;
        }
    }
}


/* =========================================================
   SAFE CLOSE
   ========================================================= */

function closeQuizGateSafely() {
    setQuizGateOpen(false);
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeCoupleQuiz
);