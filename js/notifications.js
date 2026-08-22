/* =========================================
   SUPABASE
========================================= */

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================
   STATE
========================================= */

let currentUser = null;

let notificationChannel = null;


/* =========================================
   DOM
========================================= */

const notificationsList =
    document.getElementById(
        "notificationsList"
    );


const markAllReadButton =
    document.getElementById(
        "markAllReadButton"
    );


/* =========================================
   AUTH
========================================= */

async function checkAuthentication() {

    const {
        data: { session },
        error
    } =
        await supabaseClient.auth.getSession();


    if (
        error ||
        !session
    ) {

        window.location.href =
            "./login.html";

        return false;
    }


    currentUser =
        session.user;


    return true;
}


/* =========================================
   LOAD NOTIFICATIONS
========================================= */

async function loadNotifications() {

    if (!notificationsList) {
        return;
    }


    notificationsList.innerHTML = `
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
        data,
        error
    } =
        await supabaseClient
            .from("notifications")
            .select(`
                id,
                actor_id,
                recipient_id,
                notification_type,
                message,
                memory_id,
                media_id,
                comment_id,
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
                    ascending: false
                }
            )
            .limit(100);


    if (error) {

        console.error(
            "Notification loading error:",
            error
        );


        notificationsList.innerHTML = `
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
        !data ||
        data.length === 0
    ) {

        notificationsList.innerHTML = `
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


    data.forEach(
        (notification) => {

            notificationsList.appendChild(
                createNotificationElement(
                    notification
                )
            );
        }
    );
}


/* =========================================
   CREATE NOTIFICATION
========================================= */

function createNotificationElement(
    notification
) {

    const item =
        document.createElement(
            "article"
        );


    item.className =
        "notification-item";


    if (
        notification.is_read
    ) {

        item.classList.add(
            "notification-read"
        );
    } else {

        item.classList.add(
            "notification-unread"
        );
    }


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


    content.appendChild(
        message
    );


    content.appendChild(
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


    item.appendChild(
        icon
    );


    item.appendChild(
        content
    );


    /* CLICK */

    item.addEventListener(
        "click",
        async () => {

            await markNotificationRead(
                notification.id
            );


            if (
                notification.memory_id
            ) {

                window.location.href =
                    `./app.html#memory-${notification.memory_id}`;

            } else {

                await loadNotifications();
            }
        }
    );


    return item;
}


/* =========================================
   ICON
========================================= */

function getNotificationIcon(
    type
) {

    switch (type) {

        case "new_memory":
            return "📸";

        case "new_comment":
            return "💬";

        case "comment_reply":
            return "💗";

        default:
            return "❤️";
    }
}


/* =========================================
   MARK ONE READ
========================================= */

async function markNotificationRead(
    notificationId
) {

    const {
        error
    } =
        await supabaseClient
            .from("notifications")
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


    if (error) {

        console.error(
            "Mark notification read error:",
            error
        );
    }
}


/* =========================================
   MARK ALL READ
========================================= */

async function markAllNotificationsRead() {

    if (!currentUser) {
        return;
    }


    markAllReadButton.disabled =
        true;


    try {

        const {
            error
        } =
            await supabaseClient
                .from("notifications")
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


        if (error) {

            throw error;
        }


        await loadNotifications();


    } catch (error) {

        console.error(
            "Mark all read error:",
            error
        );


    } finally {

        markAllReadButton.disabled =
            false;
    }
}


/* =========================================
   REALTIME
========================================= */

function subscribeToNotifications() {

    if (
        !currentUser
    ) {

        return;
    }


    notificationChannel =
        supabaseClient
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
                (status, error) => {

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


/* =========================================
   TIME FORMAT
========================================= */

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


/* =========================================
   INIT
========================================= */

async function initializeNotifications() {

    const authenticated =
        await checkAuthentication();


    if (!authenticated) {

        return;
    }


    markAllReadButton.addEventListener(
        "click",
        markAllNotificationsRead
    );


    await loadNotifications();


    subscribeToNotifications();
}


initializeNotifications();