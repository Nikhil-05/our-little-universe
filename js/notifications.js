/* =========================================================
   OUR LITTLE UNIVERSE
   NOTIFICATIONS.JS
========================================================= */


/* =========================================================
   SUPABASE
========================================================= */

const notificationSupabase =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================================
   STATE
========================================================= */

let currentUser =
    null;

let notificationChannel =
    null;


/* =========================================================
   DOM
========================================================= */

const notificationsList =
    document.getElementById(
        "notificationsList"
    );


const markAllReadButton =
    document.getElementById(
        "markAllReadButton"
    );


/* =========================================================
   AUTH
========================================================= */

async function checkNotificationAuthentication() {

    const {
        data: {
            session
        },
        error
    } =
        await notificationSupabase
            .auth
            .getSession();


    if (
        error
    ) {

        console.error(
            "Notification authentication error:",
            error
        );


        window.location.href =
            new URL(
                "./login.html",
                window.location.href
            ).href;


        return false;
    }


    if (
        !session
    ) {

        window.location.href =
            new URL(
                "./login.html",
                window.location.href
            ).href;


        return false;
    }


    currentUser =
        session.user;


    return true;
}


/* =========================================================
   ICON
========================================================= */

function getNotificationIcon(
    type
) {

    switch (
        type
    ) {

        case "new_memory":
            return "📸";


        case "new_comment":
            return "💬";


        case "comment_reply":
            return "💗";


        case "memory_edited":
            return "✏️";


        case "comment_edited":
            return "✏️";


        case "reply_edited":
            return "✏️";


        case "quiz_incorrect_answer":
            return "❓";


        case "quiz_answered":
            return "💕";


        default:
            return "❤️";
    }
}


/* =========================================================
   TIME
========================================================= */

function formatNotificationTime(
    timestamp
) {

    const date =
        new Date(
            timestamp
        );


    const now =
        new Date();


    const difference =
        now.getTime() -
        date.getTime();


    const minutes =
        Math.floor(
            difference /
            (1000 * 60)
        );


    if (
        minutes < 1
    ) {

        return "Just now";
    }


    if (
        minutes < 60
    ) {

        return `${minutes} min ago`;
    }


    const hours =
        Math.floor(
            minutes / 60
        );


    if (
        hours < 24
    ) {

        return `${hours} hr ago`;
    }


    const days =
        Math.floor(
            hours / 24
        );


    if (
        days === 1
    ) {

        return "Yesterday";
    }


    if (
        days < 7
    ) {

        return `${days} days ago`;
    }


    return date.toLocaleDateString(
        "en-IN",
        {

            day:
                "numeric",

            month:
                "short",

            year:
                "numeric"

        }
    );
}


/* =========================================================
   LOAD
========================================================= */

async function loadNotifications() {

    if (
        !notificationsList ||
        !currentUser
    ) {

        return;
    }


    notificationsList.innerHTML =
        `
        <div class="notifications-loading">

            <div>
                ❤️
            </div>

            <p>
                Loading our little updates...
            </p>

        </div>
    `;


    const {
        data:
            notifications,

        error

    } =
        await notificationSupabase

            .from(
                "notifications"
            )

            .select(`
                id,
                actor_id,
                recipient_id,
                notification_type,
                message,
                memory_id,
                media_id,
                comment_id,
                quiz_question_id,
                is_read,
                created_at
            `)

            .eq(
                "recipient_id",
                currentUser.id
            )

            .order(
                "created_at",
                {
                    ascending:
                        false
                }
            )

            .limit(
                100
            );


    if (
        error
    ) {

        console.error(
            "Notification loading error:",
            error
        );


        notificationsList.innerHTML =
            `
            <div class="notifications-empty">

                <div>
                    💔
                </div>

                <h2>
                    Couldn't load notifications.
                </h2>

                <p>
                    Please refresh and try again.
                </p>

            </div>
        `;


        return;
    }


    if (
        !notifications ||
        notifications.length ===
            0
    ) {

        notificationsList.innerHTML =
            `
            <div class="notifications-empty">

                <div>
                    ❤️
                </div>

                <h2>
                    Nothing new yet.
                </h2>

                <p>
                    Your little universe is peaceful.
                </p>

            </div>
        `;


        return;
    }


    notificationsList.innerHTML =
        "";


    notifications.forEach(
        (
            notification
        ) => {

            notificationsList.appendChild(
                createNotificationElement(
                    notification
                )
            );
        }
    );
}


/* =========================================================
   CREATE NOTIFICATION
========================================================= */

function createNotificationElement(
    notification
) {

    const item =
        document.createElement(
            "article"
        );


    item.className =
        "notification-item";


    item.classList.add(
        notification.is_read
            ? "notification-read"
            : "notification-unread"
    );


    /* ICON */

    const icon =
        document.createElement(
            "div"
        );


    icon.className =
        "notification-icon";


    icon.textContent =
        getNotificationIcon(
            notification.notification_type
        );


    /* CONTENT */

    const content =
        document.createElement(
            "div"
        );


    content.className =
        "notification-content";


    const message =
        document.createElement(
            "p"
        );


    message.className =
        "notification-message";


    message.textContent =
        notification.message;


    const time =
        document.createElement(
            "span"
        );


    time.className =
        "notification-time";


    time.textContent =
        formatNotificationTime(
            notification.created_at
        );


    content.append(
        message,
        time
    );


    /* UNREAD DOT */

    if (
        !notification.is_read
    ) {

        const unreadDot =
            document.createElement(
                "span"
            );


        unreadDot.className =
            "notification-unread-dot";


        item.appendChild(
            unreadDot
        );
    }


    item.append(
        icon,
        content
    );


    /* =====================================================
       CLICK
    ===================================================== */

    item.addEventListener(
        "click",
        async () => {

            await markNotificationRead(
                notification.id
            );


            /*
             * COUPLE QUIZ TARGET
             */

            if (
                notification.quiz_question_id
            ) {

                const appUrl =
                    new URL(
                        "./app.html",
                        window.location.href
                    );


                appUrl.hash =
                    `quiz-question-${notification.quiz_question_id}`;


                window.location.href =
                    appUrl.href;


                return;
            }


            /*
             * COMMENT / REPLY TARGET
             */

            if (
                notification.memory_id &&
                notification.comment_id
            ) {

                const appUrl =
                    new URL(
                        "./app.html",
                        window.location.href
                    );


                appUrl.hash =
                    `memory-${notification.memory_id}-comment-${notification.comment_id}`;


                window.location.href =
                    appUrl.href;


                return;
            }


            /*
             * MEMORY TARGET
             */

            if (
                notification.memory_id
            ) {

                const appUrl =
                    new URL(
                        "./app.html",
                        window.location.href
                    );


                appUrl.hash =
                    `memory-${notification.memory_id}`;


                window.location.href =
                    appUrl.href;


                return;
            }


            await loadNotifications();
        }
    );


    return item;
}


/* =========================================================
   MARK ONE READ
========================================================= */

async function markNotificationRead(
    notificationId
) {

    const {
        error
    } =
        await notificationSupabase

            .from(
                "notifications"
            )

            .update({

                is_read:
                    true

            })

            .eq(
                "id",
                notificationId
            )

            .eq(
                "recipient_id",
                currentUser.id
            );


    if (
        error
    ) {

        console.error(
            "Mark notification read error:",
            error
        );
    }
}


/* =========================================================
   MARK ALL READ
========================================================= */

async function markAllNotificationsRead() {

    if (
        !currentUser
    ) {

        return;
    }


    markAllReadButton.disabled =
        true;


    try {

        const {
            error
        } =
            await notificationSupabase

                .from(
                    "notifications"
                )

                .update({

                    is_read:
                        true

                })

                .eq(
                    "recipient_id",
                    currentUser.id
                )

                .eq(
                    "is_read",
                    false
                );


        if (
            error
        ) {

            throw error;
        }


        await loadNotifications();

    } catch (
        error
    ) {

        console.error(
            "Mark all read error:",
            error
        );

    } finally {

        markAllReadButton.disabled =
            false;
    }
}


/* =========================================================
   REALTIME
========================================================= */

function subscribeToNotifications() {

    if (
        !currentUser
    ) {

        return;
    }


    notificationChannel =
        notificationSupabase

            .channel(
                `notifications-${currentUser.id}`
            )

            .on(
                "postgres_changes",
                {

                    event:
                        "INSERT",

                    schema:
                        "public",

                    table:
                        "notifications",

                    filter:
                        `recipient_id=eq.${currentUser.id}`

                },

                async () => {

                    await loadNotifications();
                }

            )

            .subscribe(
                (
                    status,
                    error
                ) => {

                    if (
                        status ===
                            "CHANNEL_ERROR" ||

                        status ===
                            "TIMED_OUT"
                    ) {

                        console.error(
                            "Notification realtime error:",
                            status,
                            error
                        );
                    }
                }
            );
}


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeNotifications() {

    const authenticated =
        await checkNotificationAuthentication();


    if (
        !authenticated
    ) {

        return;
    }


    if (
        markAllReadButton
    ) {

        markAllReadButton.addEventListener(
            "click",
            markAllNotificationsRead
        );
    }


    await loadNotifications();


    subscribeToNotifications();
}


initializeNotifications();