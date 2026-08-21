/* =========================================
   SUPABASE CLIENT
========================================= */

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================================
   DOM ELEMENTS
========================================= */
const editModal =
    document.getElementById("editModal");

const closeEditButton =
    document.getElementById("closeEditButton");

const saveEditButton =
    document.getElementById("saveEditButton");

const editMessage =
    document.getElementById("editMessage");

const editMemoryTitle =
    document.getElementById("editMemoryTitle");

const editMemoryDate =
    document.getElementById("editMemoryDate");

const editMemoryDescription =
    document.getElementById(
        "editMemoryDescription"
    );

const logoutButton =
    document.getElementById("logoutButton");

const openUploadButton =
    document.getElementById("openUploadButton");

const closeUploadButton =
    document.getElementById("closeUploadButton");

const uploadModal =
    document.getElementById("uploadModal");

const dropZone =
    document.getElementById("dropZone");

const mediaInput =
    document.getElementById("mediaInput");

const uploadPreview =
    document.getElementById("uploadPreview");

const saveMemoryButton =
    document.getElementById("saveMemoryButton");

const uploadMessage =
    document.getElementById("uploadMessage");


/* =========================================
   STATE
========================================= */

let currentUser = null;

let selectedFiles = [];

let currentEditingMemory = null;


/* =========================================
   FILE CONFIGURATION
========================================= */

const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm"
];

const MAX_FILE_SIZE =
    50 * 1024 * 1024;


/* =========================================
   AUTHENTICATION
========================================= */

async function checkAuthentication() {

    const {
        data: { session },
        error
    } = await supabaseClient.auth.getSession();


    if (error) {

        console.error(
            "Authentication error:",
            error
        );

        window.location.href = "login.html";

        return false;
    }


    if (!session) {

        window.location.href = "login.html";

        return false;
    }


    currentUser = session.user;

    return true;
}


/* =========================================
   LOGOUT
========================================= */

async function logout() {

    const { error } =
        await supabaseClient.auth.signOut();


    if (error) {

        console.error(
            "Logout error:",
            error
        );

        return;
    }


    window.location.href = "login.html";
}


/* =========================================
   MODAL
========================================= */

function openModal() {

    if (!uploadModal) {
        return;
    }

    uploadModal.classList.remove("hidden");

    document.body.style.overflow = "hidden";
}


function closeModal() {

    if (!uploadModal) {
        return;
    }

    uploadModal.classList.add("hidden");

    document.body.style.overflow = "";

    resetUploadForm();
}


/* =========================================
   RESET UPLOAD FORM
========================================= */

function resetUploadForm() {

    const memoryTitle =
        document.getElementById("memoryTitle");

    const memoryDate =
        document.getElementById("memoryDate");

    const memoryDescription =
        document.getElementById("memoryDescription");


    if (memoryTitle) {
        memoryTitle.value = "";
    }


    if (memoryDate) {

        memoryDate.value =
            new Date()
                .toISOString()
                .split("T")[0];
    }


    if (memoryDescription) {
        memoryDescription.value = "";
    }


    if (mediaInput) {
        mediaInput.value = "";
    }


    /* Release previously created preview URLs */

    if (uploadPreview) {

        const previewMedia =
            uploadPreview.querySelectorAll(
                "img, video"
            );


        previewMedia.forEach((element) => {

            if (element.src) {

                URL.revokeObjectURL(
                    element.src
                );
            }
        });


        uploadPreview.innerHTML = "";
    }


    selectedFiles = [];


    if (uploadMessage) {
        uploadMessage.textContent = "";
    }


    if (saveMemoryButton) {

        saveMemoryButton.disabled = false;

        saveMemoryButton.textContent =
            "Save Memory ❤️";
    }
}


/* =========================================
   FILE VALIDATION
========================================= */

function validateFile(file) {

    if (!allowedTypes.includes(file.type)) {

        return {
            valid: false,
            message:
                `${file.name} is not a supported file type.`
        };
    }


    if (file.size > MAX_FILE_SIZE) {

        return {
            valid: false,
            message:
                `${file.name} is larger than 50 MB.`
        };
    }


    return {
        valid: true
    };
}


/* =========================================
   ADD FILES
========================================= */

function addFiles(files) {

    const incomingFiles =
        Array.from(files);


    if (incomingFiles.length === 0) {
        return;
    }


    let hasInvalidFile = false;


    for (const file of incomingFiles) {

        const validation =
            validateFile(file);


        if (!validation.valid) {

            hasInvalidFile = true;

            if (uploadMessage) {

                uploadMessage.textContent =
                    validation.message;
            }

            continue;
        }


        selectedFiles.push(file);
    }


    renderPreviews();


    if (!hasInvalidFile && uploadMessage) {

        uploadMessage.textContent =
            `${selectedFiles.length} file(s) selected ❤️`;
    }
}


/* =========================================
   RENDER UPLOAD PREVIEWS
========================================= */

function renderPreviews() {

    if (!uploadPreview) {
        return;
    }


    /* Release old preview URLs */

    const previousMedia =
        uploadPreview.querySelectorAll(
            "img, video"
        );


    previousMedia.forEach((element) => {

        if (element.src) {

            URL.revokeObjectURL(
                element.src
            );
        }
    });


    uploadPreview.innerHTML = "";


    selectedFiles.forEach((file) => {

        const preview =
            document.createElement("div");

        preview.className =
            "preview-item";


        const url =
            URL.createObjectURL(file);


        if (file.type.startsWith("image/")) {

            const img =
                document.createElement("img");

            img.src = url;

            img.alt = file.name;

            preview.appendChild(img);

        } else {

            const video =
                document.createElement("video");

            video.src = url;

            video.muted = true;

            video.preload = "metadata";

            preview.appendChild(video);
        }


        const typeBadge =
            document.createElement("span");

        typeBadge.className =
            "preview-type";

        typeBadge.textContent =
            file.type.startsWith("video/")
                ? "VIDEO"
                : "PHOTO";


        preview.appendChild(typeBadge);


        uploadPreview.appendChild(preview);
    });
}


/* =========================================
   CREATE MEMORY
========================================= */

async function createMemory() {

    const titleInput =
        document.getElementById("memoryTitle");

    const dateInput =
        document.getElementById("memoryDate");

    const descriptionInput =
        document.getElementById("memoryDescription");


    if (
        !titleInput ||
        !dateInput ||
        !descriptionInput
    ) {

        console.error(
            "Memory form elements are missing."
        );

        return;
    }


    const title =
        titleInput.value.trim();

    const date =
        dateInput.value;

    const description =
        descriptionInput.value.trim();


    /* =====================================
       VALIDATE FORM
    ===================================== */

    if (!title) {

        uploadMessage.textContent =
            "Give this memory a title ❤️";

        return;
    }


    if (!date) {

        uploadMessage.textContent =
            "Please choose the memory date.";

        return;
    }


    if (selectedFiles.length === 0) {

        uploadMessage.textContent =
            "Add at least one photo or video.";

        return;
    }


    if (!currentUser) {

        uploadMessage.textContent =
            "Your session has expired. Please log in again.";

        return;
    }


    /* =====================================
       DISABLE SAVE BUTTON
    ===================================== */

    saveMemoryButton.disabled = true;

    saveMemoryButton.textContent =
        "Saving our memory... ❤️";


    let createdMemory = null;


    try {

        /* =====================================
           1. CREATE MEMORY RECORD
        ===================================== */

        const {
            data: memory,
            error: memoryError
        } = await supabaseClient
            .from("memories")
            .insert({
                title: title,

                description:
                    description || null,

                memory_date: date,

                created_by:
                    currentUser.id
            })
            .select()
            .single();


        if (memoryError) {

            throw memoryError;
        }


        createdMemory = memory;


        /* =====================================
           2. UPLOAD EACH FILE
        ===================================== */

        for (
            let index = 0;
            index < selectedFiles.length;
            index++
        ) {

            const file =
                selectedFiles[index];


            uploadMessage.textContent =
                `Uploading ${index + 1} of ${selectedFiles.length}...`;


            const fileExtension =
                file.name
                    .split(".")
                    .pop()
                    .toLowerCase();


            const uniqueName =
                `${crypto.randomUUID()}.${fileExtension}`;


            const folder =
                file.type.startsWith("video/")
                    ? "videos"
                    : "photos";


            const filePath =
                `${currentUser.id}/${memory.id}/${folder}/${uniqueName}`;


            const {
                error: uploadError
            } = await supabaseClient
                .storage
                .from("memory-media")
                .upload(
                    filePath,
                    file,
                    {
                        contentType:
                            file.type,

                        cacheControl:
                            "3600",

                        upsert:
                            false
                    }
                );


            if (uploadError) {

                throw uploadError;
            }


            /* =================================
               3. SAVE MEDIA RECORD
            ================================= */

            const {
                error: mediaError
            } = await supabaseClient
                .from("media")
                .insert({

                    memory_id:
                        memory.id,

                    file_name:
                        file.name,

                    file_path:
                        filePath,

                    media_type:
                        file.type.startsWith("video/")
                            ? "video"
                            : "image",

                    created_by:
                        currentUser.id
                });


            if (mediaError) {

                throw mediaError;
            }
        }


        /* =====================================
           SUCCESS
        ===================================== */

        uploadMessage.textContent =
            "Memory saved ❤️";


        /*
         * Close modal after a short delay,
         * then refresh timeline.
         */

        setTimeout(async () => {

            closeModal();

            await loadMemories();

        }, 700);


    } catch (error) {

        console.error(
            "Create memory error:",
            error
        );


        uploadMessage.textContent =
            "Something went wrong while saving this memory.";


        saveMemoryButton.disabled =
            false;

        saveMemoryButton.textContent =
            "Save Memory ❤️";


        /*
         * If the memory was created but
         * something failed afterward,
         * we currently leave the database
         * record so that we can inspect it.
         *
         * We'll add proper transactional
         * cleanup later.
         */

        if (createdMemory) {

            console.warn(
                "A memory record was created before the error:",
                createdMemory.id
            );
        }
    }
}


/* =========================================
   LOAD MEMORIES
========================================= */

async function loadMemories() {

    const timeline =
        document.getElementById("timeline");


    if (!timeline) {
        return;
    }


    timeline.innerHTML = `
        <div class="loading-state">
            <div class="loading-heart">❤️</div>

            <p>
                Loading our memories...
            </p>
        </div>
    `;


    const {
        data: memories,
        error
    } = await supabaseClient
        .from("memories")
        .select(`
            id,
            title,
            description,
            memory_date,
            created_by,
            created_at,
            media (
                id,
                file_name,
                file_path,
                media_type,
                created_by,
                created_at
            )
        `)
        .order(
            "memory_date",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Error loading memories:",
            error
        );


        timeline.innerHTML = `
            <div class="empty-state">

                <div class="empty-heart">
                    💔
                </div>

                <h2>
                    Couldn't load our memories.
                </h2>

                <p>
                    Please refresh and try again.
                </p>

            </div>
        `;


        return;
    }


    if (
        !memories ||
        memories.length === 0
    ) {

        timeline.innerHTML = `
            <div class="empty-state">

                <div class="empty-heart">
                    ❤️
                </div>

                <h2>
                    Our story starts here.
                </h2>

                <p>
                    Add your first memory together.
                </p>

            </div>
        `;


        return;
    }


    timeline.innerHTML = "";


    for (const memory of memories) {

        const memoryElement =
            await createMemoryElement(
                memory
            );


        timeline.appendChild(
            memoryElement
        );
    }
}


/* =========================================
   CREATE SIGNED MEDIA URL
========================================= */

async function getSignedMediaUrl(filePath) {

    const {
        data,
        error
    } = await supabaseClient
        .storage
        .from("memory-media")
        .createSignedUrl(
            filePath,
            60 * 60 * 24
        );


    if (error) {

        console.error(
            "Error creating signed URL:",
            error
        );

        return null;
    }


    return data?.signedUrl || null;
}


/* =========================================
   CREATE MEMORY ELEMENT
========================================= */

async function createMemoryElement(memory) {

    const article =
        document.createElement("article");

    article.className =
        "memory-card";


    const formattedDate =
        formatMemoryDate(
            memory.memory_date
        );


    /* =====================================
       MEMORY HEADER
    ===================================== */

    const header =
        document.createElement("div");

    header.className =
        "memory-header";


    const memoryInfo =
        document.createElement("div");


    memoryInfo.innerHTML = `
        <span class="memory-date">
            ${formattedDate}
        </span>

        <h2>
            ${escapeHtml(memory.title)}
        </h2>
    `;


    /* =====================================
       ACTION BUTTONS
    ===================================== */

    const actions =
        document.createElement("div");

    actions.className =
        "memory-actions";


    const editButton =
        document.createElement("button");

    editButton.className =
        "memory-action edit-memory";

    editButton.type =
        "button";

    editButton.innerHTML =
        "✏️ Edit";


    const deleteButton =
        document.createElement("button");

    deleteButton.className =
        "memory-action delete-memory";

    deleteButton.type =
        "button";

    deleteButton.innerHTML =
        "🗑️ Delete";


    actions.appendChild(
        editButton
    );

    actions.appendChild(
        deleteButton
    );


    header.appendChild(
        memoryInfo
    );

    header.appendChild(
        actions
    );


    article.appendChild(
        header
    );


    /* =====================================
       DESCRIPTION
    ===================================== */

    if (memory.description) {

        const description =
            document.createElement("p");

        description.className =
            "memory-description";

        description.innerHTML =
            escapeHtml(
                memory.description
            );

        article.appendChild(
            description
        );
    }


    /* =====================================
       MEDIA GRID
    ===================================== */

    const mediaItems =
        memory.media || [];


    if (mediaItems.length > 0) {

        const mediaGrid =
            document.createElement("div");

        mediaGrid.className =
            "media-grid";


        for (
            const media of mediaItems
        ) {

            const signedUrl =
                await getSignedMediaUrl(
                    media.file_path
                );


            if (!signedUrl) {
                continue;
            }


            const mediaElement =
                createMediaElement(
                    media,
                    signedUrl
                );


            mediaGrid.appendChild(
                mediaElement
            );
        }


        if (
            mediaGrid.children.length > 0
        ) {

            article.appendChild(
                mediaGrid
            );
        }
    }


    /* =====================================
       AUTHOR
    ===================================== */

    const author =
        document.createElement("p");

    author.className =
        "memory-author";

    author.textContent =
        "A memory from our little universe ❤️";


    article.appendChild(
        author
    );


    /* =====================================
       BUTTON EVENTS
    ===================================== */

    editButton.addEventListener(
        "click",
        () => {

            openEditModal(memory);

        }
    );


    deleteButton.addEventListener(
        "click",
        () => {

            deleteMemory(memory);

        }
    );


    return article;
}


/* =========================================
   CREATE MEDIA ELEMENT
========================================= */

function createMediaElement(
    media,
    signedUrl
) {

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "media-item";


    /* =====================================
       IMAGE
    ===================================== */

    if (
        media.media_type === "image"
    ) {

        const image =
            document.createElement("img");


        image.src =
            signedUrl;


        image.alt =
            media.file_name;


        image.loading =
            "lazy";


        wrapper.appendChild(
            image
        );


    /* =====================================
       VIDEO
    ===================================== */

    } else if (
        media.media_type === "video"
    ) {

        wrapper.classList.add(
            "media-video"
        );


        const video =
            document.createElement("video");


        video.src =
            signedUrl;


        video.controls =
            true;


        video.preload =
            "metadata";


        video.playsInline =
            true;


        wrapper.appendChild(
            video
        );
    }


    return wrapper;
}


/* =========================================
   FORMAT DATE
========================================= */

function formatMemoryDate(
    dateString
) {

    const date =
        new Date(
            `${dateString}T00:00:00`
        );


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",

            month: "long",

            year: "numeric"
        }
    );
}


/* =========================================
   ESCAPE HTML
========================================= */

function escapeHtml(value) {

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

/* =========================================
   OPEN EDIT MODAL
========================================= */

function openEditModal(memory) {

    if (!editModal) {
        return;
    }


    currentEditingMemory =
        memory;


    editMemoryTitle.value =
        memory.title || "";


    editMemoryDate.value =
        memory.memory_date || "";


    editMemoryDescription.value =
        memory.description || "";


    editMessage.textContent = "";


    saveEditButton.disabled =
        false;


    saveEditButton.textContent =
        "Save Changes ❤️";


    editModal.classList.remove(
        "hidden"
    );


    document.body.style.overflow =
        "hidden";
}


/* =========================================
   CLOSE EDIT MODAL
========================================= */

function closeEditModal() {

    if (!editModal) {
        return;
    }


    editModal.classList.add(
        "hidden"
    );


    document.body.style.overflow =
        "";


    currentEditingMemory =
        null;
}

/* =========================================
   UPDATE MEMORY
========================================= */

async function updateMemory() {

    if (!currentEditingMemory) {

        return;
    }


    const title =
        editMemoryTitle.value.trim();


    const date =
        editMemoryDate.value;


    const description =
        editMemoryDescription.value.trim();


    /* =====================================
       VALIDATION
    ===================================== */

    if (!title) {

        editMessage.textContent =
            "Please give the memory a title.";

        return;
    }


    if (!date) {

        editMessage.textContent =
            "Please select a date.";

        return;
    }


    saveEditButton.disabled =
        true;


    saveEditButton.textContent =
        "Saving changes... ❤️";


    try {

        const {
            error
        } = await supabaseClient
            .from("memories")
            .update({

                title: title,

                memory_date: date,

                description:
                    description || null

            })
            .eq(
                "id",
                currentEditingMemory.id
            );


        if (error) {

            throw error;
        }


        editMessage.textContent =
            "Changes saved ❤️";


        setTimeout(async () => {

            closeEditModal();

            await loadMemories();

        }, 500);


    } catch (error) {

        console.error(
            "Update memory error:",
            error
        );


        editMessage.textContent =
            "Couldn't save the changes.";


        saveEditButton.disabled =
            false;


        saveEditButton.textContent =
            "Save Changes ❤️";
    }
}

/* =========================================
   DELETE MEMORY
========================================= */

async function deleteMemory(memory) {

    const confirmed =
        window.confirm(
            `Delete "${memory.title}"?\n\nThis will permanently delete the memory and all of its photos/videos.`
        );


    if (!confirmed) {

        return;
    }


    try {

        /* =====================================
           1. GET MEDIA
        ===================================== */

        const {
            data: mediaItems,
            error: mediaFetchError
        } = await supabaseClient
            .from("media")
            .select(
                "file_path"
            )
            .eq(
                "memory_id",
                memory.id
            );


        if (mediaFetchError) {

            throw mediaFetchError;
        }


        /* =====================================
           2. DELETE STORAGE FILES
        ===================================== */

        if (
            mediaItems &&
            mediaItems.length > 0
        ) {

            const filePaths =
                mediaItems.map(
                    (media) =>
                        media.file_path
                );


            const {
                error: storageError
            } = await supabaseClient
                .storage
                .from("memory-media")
                .remove(
                    filePaths
                );


            if (storageError) {

                throw storageError;
            }
        }


        /* =====================================
           3. DELETE MEDIA RECORDS
        ===================================== */

        const {
            error: mediaDeleteError
        } = await supabaseClient
            .from("media")
            .delete()
            .eq(
                "memory_id",
                memory.id
            );


        if (mediaDeleteError) {

            throw mediaDeleteError;
        }


        /* =====================================
           4. DELETE MEMORY
        ===================================== */

        const {
            error: memoryDeleteError
        } = await supabaseClient
            .from("memories")
            .delete()
            .eq(
                "id",
                memory.id
            );


        if (memoryDeleteError) {

            throw memoryDeleteError;
        }


        /* =====================================
           5. REFRESH TIMELINE
        ===================================== */

        await loadMemories();


    } catch (error) {

        console.error(
            "Delete memory error:",
            error
        );


        alert(
            "Something went wrong while deleting this memory."
        );
    }
}
/* =========================================
   EVENT LISTENERS
========================================= */

/* Logout */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        logout
    );
}


/* Open upload modal */

if (openUploadButton) {

    openUploadButton.addEventListener(
        "click",
        openModal
    );
}


/* Close upload modal */

if (closeUploadButton) {

    closeUploadButton.addEventListener(
        "click",
        closeModal
    );
}


/* Click outside modal */

if (uploadModal) {

    uploadModal.addEventListener(
        "click",
        (event) => {

            if (
                event.target === uploadModal
            ) {

                closeModal();
            }
        }
    );
}


/* =========================================
   DROP ZONE
========================================= */

if (dropZone) {

    dropZone.addEventListener(
        "click",
        () => {

            if (mediaInput) {

                mediaInput.click();
            }
        }
    );


    dropZone.addEventListener(
        "dragover",
        (event) => {

            event.preventDefault();


            dropZone.classList.add(
                "drag-over"
            );
        }
    );


    dropZone.addEventListener(
        "dragleave",
        () => {

            dropZone.classList.remove(
                "drag-over"
            );
        }
    );


    dropZone.addEventListener(
        "drop",
        (event) => {

            event.preventDefault();


            dropZone.classList.remove(
                "drag-over"
            );


            if (
                event.dataTransfer &&
                event.dataTransfer.files
            ) {

                addFiles(
                    event.dataTransfer.files
                );
            }
        }
    );
}


/* =========================================
   FILE INPUT
========================================= */

if (mediaInput) {

    mediaInput.addEventListener(
        "change",
        () => {

            addFiles(
                mediaInput.files
            );
        }
    );
}


/* =========================================
   SAVE MEMORY BUTTON
========================================= */

if (saveMemoryButton) {

    saveMemoryButton.addEventListener(
        "click",
        createMemory
    );
}

/* =========================================
   EDIT MODAL EVENTS
========================================= */

if (closeEditButton) {

    closeEditButton.addEventListener(
        "click",
        closeEditModal
    );
}


if (saveEditButton) {

    saveEditButton.addEventListener(
        "click",
        updateMemory
    );
}


if (editModal) {

    editModal.addEventListener(
        "click",
        (event) => {

            if (
                event.target === editModal
            ) {

                closeEditModal();
            }
        }
    );
}


/* =========================================
   START APPLICATION
========================================= */

async function initializeApp() {

    const authenticated =
        await checkAuthentication();


    if (!authenticated) {

        return;
    }


    resetUploadForm();


    await loadMemories();
}


initializeApp();