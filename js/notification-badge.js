/* =========================================
   SUPABASE
========================================= */

const notificationSupabase =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


let notificationUser =
    null;


let notificationChannel =
    null;


/* =========================================
   DOM
========================================= */

const notificationBadge =
    document.getElementById(
        "notificationBadge"
    );


/* =========================================
   LOAD SESSION
========================================= */

async function initializeNotificationBadge() {

    if (
        !notificationBadge
    ) {

        return;
    }


    const {
        data: { session },
        error
    } =
        await notificationSupabase.auth.getSession();


    if (
        error ||
        !session
    ) {

        return;
    }


    notificationUser =
        session.user;


    await refreshNotificationBadge();


    subscribeNotificationBadge();
}


/* =========================================
   COUNT UNREAD
========================================= */

async function refreshNotificationBadge() {

    if (
        !notificationUser ||
        !notificationBadge
    ) {

        return;
    }


    const {
        count,
        error
    } =
        await notificationSupabase
            .from("notifications")
            .select(
                "id",
                {
                    count:
                        "exact",

                    head:
                        true
                }
            )
            .eq(
                "recipient_id",
                notificationUser.id
            )
            .eq(
                "is_read",
                false
            );


    if (error) {

        console.error(
            "Notification badge error:",
            error
        );

        return;
    }


    const unreadCount =
        count || 0;


    if (
        unreadCount === 0
    ) {

        notificationBadge.classList.add(
            "hidden"
        );

        notificationBadge.textContent =
            "0";


        return;
    }


    notificationBadge.classList.remove(
        "hidden"
    );


    notificationBadge.textContent =
        unreadCount > 99
            ? "99+"
            : String(
                unreadCount
            );
}


/* =========================================
   REALTIME
========================================= */

function subscribeNotificationBadge() {

    notificationChannel =
        notificationSupabase
            .channel(
                `notification-badge-${notificationUser.id}`
            )
            .on(
                "postgres_changes",
                {
                    event:
                        "*",

                    schema:
                        "public",

                    table:
                        "notifications",

                    filter:
                        `recipient_id=eq.${notificationUser.id}`
                },
                async () => {

                    await refreshNotificationBadge();
                }
            )
            .subscribe();
}


initializeNotificationBadge();