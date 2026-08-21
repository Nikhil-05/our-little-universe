/* =========================================
   SUPABASE CLIENT
========================================= */

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


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


    window.location.href =
        "login.html";
}


/* =========================================
   UPLOAD MODAL
========================================= */

function openModal() {

    const modal =
        document.getElementById(
            "uploadModal"
        );


    if (!modal) {

        console.error(
            "Upload modal not found."
        );

        return;
    }


    modal.classList.remove(
        "hidden"
    );


    document.body.style.overflow =
        "hidden";
}


function closeModal() {

    const modal =
        document.getElementById(
            "uploadModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );


    document.body.style.overflow =
        "";


    resetUploadForm();
}


/* =========================================
   RESET UPLOAD FORM
========================================= */

function resetUploadForm() {

    const title =
        document.getElementById(
            "memoryTitle"
        );

    const date =
        document.getElementById(
            "memoryDate"
        );

    const description =
        document.getElementById(
            "memoryDescription"
        );

    const input =
        document.getElementById(
            "mediaInput"
        );

    const preview =
        document.getElementById(
            "uploadPreview"
        );

    const message =
        document.getElementById(
            "uploadMessage"
        );

    const saveButton =
        document.getElementById(
            "saveMemoryButton"
        );


    if (title) {
        title.value = "";
    }


    if (date) {

        date.value =
            new Date()
                .toISOString()
                .split("T")[0];
    }


    if (description) {
        description.value = "";
    }


    if (input) {
        input.value = "";
    }


    if (preview) {
        preview.innerHTML = "";
    }


    if (message) {
        message.textContent = "";
    }


    if (saveButton) {

        saveButton.disabled =
            false;

        saveButton.textContent =
            "Save Memory ❤️";
    }


    selectedFiles = [];
}


/* =========================================
   FILE VALIDATION
========================================= */

function validateFile(file) {

    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        return {
            valid: false,

            message:
                `${file.name} is not a supported file type.`
        };
    }


    if (
        file.size > MAX_FILE_SIZE
    ) {

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


    for (
        const file of incomingFiles
    ) {

        const validation =
            validateFile(file);


        if (!validation.valid) {

            const message =
                document.getElementById(
                    "uploadMessage"
                );


            if (message) {

                message.textContent =
                    validation.message;
            }


            continue;
        }


        selectedFiles.push(
            file
        );
    }


    renderPreviews();
}


/* =========================================
   RENDER PREVIEWS
========================================= */

function renderPreviews() {

    const preview =
        document.getElementById(
            "uploadPreview"
        );


    if (!preview) {
        return;
    }


    preview.innerHTML = "";


    selectedFiles.forEach(
        (file) => {

            const wrapper =
                document.createElement(
                    "div"
                );


            wrapper.className =
                "preview-item";


            const url =
                URL.createObjectURL(
                    file
                );


            if (
                file.type.startsWith(
                    "image/"
                )
            ) {

                const image =
                    document.createElement(
                        "img"
                    );


                image.src = url;

                image.alt =
                    file.name;


                wrapper.appendChild(
                    image
                );

            } else {

                const video =
                    document.createElement(
                        "video"
                    );


                video.src = url;

                video.muted =
                    true;

                video.preload =
                    "metadata";


                wrapper.appendChild(
                    video
                );
            }


            const badge =
                document.createElement(
                    "span"
                );


            badge.className =
                "preview-type";


            badge.textContent =
                file.type.startsWith(
                    "video/"
                )
                    ? "VIDEO"
                    : "PHOTO";


            wrapper.appendChild(
                badge
            );


            preview.appendChild(
                wrapper
            );
        }
    );
}


/* =========================================
   CREATE MEMORY
========================================= */

async function createMemory() {

    const titleInput =
        document.getElementById(
            "memoryTitle"
        );

    const dateInput =
        document.getElementById(
            "memoryDate"
        );

    const descriptionInput =
        document.getElementById(
            "memoryDescription"
        );

    const saveButton =
        document.getElementById(
            "saveMemoryButton"
        );

    const message =
        document.getElementById(
            "uploadMessage"
        );


    if (
        !titleInput ||
        !dateInput ||
        !descriptionInput ||
        !saveButton ||
        !message
    ) {

        console.error(
            "Upload form elements missing."
        );

        return;
    }


    const title =
        titleInput.value.trim();

    const date =
        dateInput.value;

    const description =
        descriptionInput.value.trim();


    if (!title) {

        message.textContent =
            "Give this memory a title ❤️";

        return;
    }


    if (!date) {

        message.textContent =
            "Please choose the memory date.";

        return;
    }


    if (
        selectedFiles.length === 0
    ) {

        message.textContent =
            "Add at least one photo or video.";

        return;
    }


    saveButton.disabled =
        true;

    saveButton.textContent =
        "Saving our memory... ❤️";


    try {

        /* CREATE MEMORY */

        const {
            data: memory,
            error: memoryError
        } = await supabaseClient
            .from("memories")
            .insert({
                title,

                description:
                    description || null,

                memory_date:
                    date,

                created_by:
                    currentUser.id
            })
            .select()
            .single();


        if (memoryError) {

            throw memoryError;
        }


        /* UPLOAD FILES */

        for (
            let index = 0;
            index < selectedFiles.length;
            index++
        ) {

            const file =
                selectedFiles[index];


            message.textContent =
                `Uploading ${index + 1} of ${selectedFiles.length}...`;


            const extension =
                file.name
                    .split(".")
                    .pop()
                    .toLowerCase();


            const uniqueName =
                `${crypto.randomUUID()}.${extension}`;


            const folder =
                file.type.startsWith(
                    "video/"
                )
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


            /* SAVE MEDIA RECORD */

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
                        file.type.startsWith(
                            "video/"
                        )
                            ? "video"
                            : "image",

                    created_by:
                        currentUser.id
                });


            if (mediaError) {

                throw mediaError;
            }
        }


        message.textContent =
            "Memory saved ❤️";


        setTimeout(
            async () => {

                closeModal();

                await loadMemories();

            },
            600
        );


    } catch (error) {

        console.error(
            "Create memory error:",
            error
        );


        message.textContent =
            "Something went wrong while saving this memory.";


        saveButton.disabled =
            false;

        saveButton.textContent =
            "Save Memory ❤️";
    }
}


/* =========================================
   LOAD MEMORIES
========================================= */

async function loadMemories() {

    const timeline =
        document.getElementById(
            "timeline"
        );


    if (!timeline) {
        return;
    }


    timeline.innerHTML = `
        <div class="loading-state">

            <div class="loading-heart">
                ❤️
            </div>

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


    for (
        const memory of memories
    ) {

        const element =
            await createMemoryElement(
                memory
            );


        timeline.appendChild(
            element
        );
    }
}


/* =========================================
   SIGNED MEDIA URL
========================================= */

async function getSignedMediaUrl(
    filePath
) {

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
            "Signed URL error:",
            error
        );

        return null;
    }


    return data?.signedUrl || null;
}


/* =========================================
   CREATE MEMORY ELEMENT
========================================= */

async function createMemoryElement(
    memory
) {

    const article =
        document.createElement(
            "article"
        );


    article.className =
        "memory-card";


    /* HEADER */

    const header =
        document.createElement(
            "div"
        );


    header.className =
        "memory-header";


    const info =
        document.createElement(
            "div"
        );


    info.innerHTML = `
        <span class="memory-date">
            ${formatMemoryDate(
                memory.memory_date
            )}
        </span>

        <h2>
            ${escapeHtml(
                memory.title
            )}
        </h2>
    `;


    /* ACTIONS */

    const actions =
        document.createElement(
            "div"
        );


    actions.className =
        "memory-actions";


    const editButton =
        document.createElement(
            "button"
        );


    editButton.type =
        "button";


    editButton.className =
        "memory-action edit-memory";


    editButton.textContent =
        "✏️ Edit";


    const deleteButton =
        document.createElement(
            "button"
        );


    deleteButton.type =
        "button";


    deleteButton.className =
        "memory-action delete-memory";


    deleteButton.textContent =
        "🗑️ Delete";


    actions.appendChild(
        editButton
    );


    actions.appendChild(
        deleteButton
    );


    header.appendChild(
        info
    );


    header.appendChild(
        actions
    );


    article.appendChild(
        header
    );


    /* DESCRIPTION */

    if (memory.description) {

        const description =
            document.createElement(
                "p"
            );


        description.className =
            "memory-description";


        description.textContent =
            memory.description;


        article.appendChild(
            description
        );
    }


    /* MEDIA */

    const mediaItems =
        memory.media || [];


    if (
        mediaItems.length > 0
    ) {

        const grid =
            document.createElement(
                "div"
            );


        grid.className =
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


            const element =
                createMediaElement(
                    media,
                    signedUrl
                );


            grid.appendChild(
                element
            );
        }


        if (
            grid.children.length > 0
        ) {

            article.appendChild(
                grid
            );
        }
    }


    /* AUTHOR */

    const author =
        document.createElement(
            "p"
        );


    author.className =
        "memory-author";


    author.textContent =
        "A memory from our little universe ❤️";


    article.appendChild(
        author
    );


    /* EDIT EVENT */

    editButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            event.stopPropagation();

            openEditModal(
                memory
            );
        }
    );


    /* DELETE EVENT */

    deleteButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            event.stopPropagation();

            deleteMemory(
                memory
            );
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
        document.createElement(
            "div"
        );


    wrapper.className =
        "media-item";


    if (
        media.media_type === "image"
    ) {

        const image =
            document.createElement(
                "img"
            );


        image.src =
            signedUrl;


        image.alt =
            media.file_name;


        image.loading =
            "lazy";


        wrapper.appendChild(
            image
        );

    } else if (
        media.media_type === "video"
    ) {

        wrapper.classList.add(
            "media-video"
        );


        const video =
            document.createElement(
                "video"
            );


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
   EDIT MODAL
========================================= */

function openEditModal(
    memory
) {

    const modal =
        document.getElementById(
            "editModal"
        );

    const titleInput =
        document.getElementById(
            "editMemoryTitle"
        );

    const dateInput =
        document.getElementById(
            "editMemoryDate"
        );

    const descriptionInput =
        document.getElementById(
            "editMemoryDescription"
        );

    const message =
        document.getElementById(
            "editMessage"
        );

    const saveButton =
        document.getElementById(
            "saveEditButton"
        );


    if (
        !modal ||
        !titleInput ||
        !dateInput ||
        !descriptionInput ||
        !message ||
        !saveButton
    ) {

        console.error(
            "Edit modal is missing one or more required elements."
        );

        return;
    }


    currentEditingMemory =
        memory;


    titleInput.value =
        memory.title || "";


    dateInput.value =
        memory.memory_date || "";


    descriptionInput.value =
        memory.description || "";


    message.textContent =
        "";


    saveButton.disabled =
        false;


    saveButton.textContent =
        "Save Changes ❤️";


    modal.classList.remove(
        "hidden"
    );


    document.body.style.overflow =
        "hidden";


    /* Put cursor inside title */

    titleInput.focus();
}


/* =========================================
   CLOSE EDIT MODAL
========================================= */

function closeEditModal() {

    const modal =
        document.getElementById(
            "editModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
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

        console.error(
            "No memory selected for editing."
        );

        return;
    }


    const titleInput =
        document.getElementById(
            "editMemoryTitle"
        );

    const dateInput =
        document.getElementById(
            "editMemoryDate"
        );

    const descriptionInput =
        document.getElementById(
            "editMemoryDescription"
        );

    const message =
        document.getElementById(
            "editMessage"
        );

    const saveButton =
        document.getElementById(
            "saveEditButton"
        );


    if (
        !titleInput ||
        !dateInput ||
        !descriptionInput ||
        !message ||
        !saveButton
    ) {

        console.error(
            "Edit form elements are missing."
        );

        return;
    }


    const title =
        titleInput.value.trim();

    const date =
        dateInput.value;

    const description =
        descriptionInput.value.trim();


    if (!title) {

        message.textContent =
            "Please give the memory a title.";

        return;
    }


    if (!date) {

        message.textContent =
            "Please select a date.";

        return;
    }


    saveButton.disabled =
        true;


    saveButton.textContent =
        "Saving changes... ❤️";


    try {

        const {
            error
        } = await supabaseClient
            .from("memories")
            .update({
                title,

                memory_date:
                    date,

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


        message.textContent =
            "Changes saved ❤️";


        await new Promise(
            (resolve) =>
                setTimeout(
                    resolve,
                    500
                )
        );


        closeEditModal();


        await loadMemories();


    } catch (error) {

        console.error(
            "Update memory error:",
            error
        );


        message.textContent =
            "Couldn't save the changes.";


        saveButton.disabled =
            false;


        saveButton.textContent =
            "Save Changes ❤️";
    }
}


/* =========================================
   DELETE MEMORY
========================================= */

async function deleteMemory(
    memory
) {

    const confirmed =
        window.confirm(
            `Delete "${memory.title}"?\n\nThis will permanently delete the memory and all of its photos/videos.`
        );


    if (!confirmed) {
        return;
    }


    try {

        /* GET MEDIA */

        const {
            data: mediaItems,
            error: fetchError
        } = await supabaseClient
            .from("media")
            .select(
                "file_path"
            )
            .eq(
                "memory_id",
                memory.id
            );


        if (fetchError) {

            throw fetchError;
        }


        /* DELETE STORAGE FILES */

        if (
            mediaItems &&
            mediaItems.length > 0
        ) {

            const paths =
                mediaItems.map(
                    (item) =>
                        item.file_path
                );


            const {
                error: storageError
            } = await supabaseClient
                .storage
                .from("memory-media")
                .remove(
                    paths
                );


            if (storageError) {

                throw storageError;
            }
        }


        /* DELETE MEDIA ROWS */

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


        /* DELETE MEMORY */

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

function escapeHtml(
    value
) {

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
   EVENT LISTENERS
========================================= */

function setupEventListeners() {

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );

    const openUploadButton =
        document.getElementById(
            "openUploadButton"
        );

    const closeUploadButton =
        document.getElementById(
            "closeUploadButton"
        );

    const uploadModal =
        document.getElementById(
            "uploadModal"
        );

    const dropZone =
        document.getElementById(
            "dropZone"
        );

    const mediaInput =
        document.getElementById(
            "mediaInput"
        );

    const saveMemoryButton =
        document.getElementById(
            "saveMemoryButton"
        );

    const closeEditButton =
        document.getElementById(
            "closeEditButton"
        );

    const saveEditButton =
        document.getElementById(
            "saveEditButton"
        );

    const editModal =
        document.getElementById(
            "editModal"
        );


    /* LOGOUT */

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            logout
        );
    }


    /* OPEN UPLOAD */

    if (openUploadButton) {

        openUploadButton.addEventListener(
            "click",
            openModal
        );
    }


    /* CLOSE UPLOAD */

    if (closeUploadButton) {

        closeUploadButton.addEventListener(
            "click",
            closeModal
        );
    }


    /* CLICK OUTSIDE UPLOAD */

    if (uploadModal) {

        uploadModal.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    uploadModal
                ) {

                    closeModal();
                }
            }
        );
    }


    /* DROP ZONE */

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
                    event.dataTransfer
                ) {

                    addFiles(
                        event.dataTransfer.files
                    );
                }
            }
        );
    }


    /* FILE INPUT */

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


    /* SAVE MEMORY */

    if (saveMemoryButton) {

        saveMemoryButton.addEventListener(
            "click",
            createMemory
        );
    }


    /* CLOSE EDIT */

    if (closeEditButton) {

        closeEditButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                closeEditModal();
            }
        );
    }


    /* SAVE EDIT */

    if (saveEditButton) {

        saveEditButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                updateMemory();
            }
        );
    }


    /* CLICK OUTSIDE EDIT */

    if (editModal) {

        editModal.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    editModal
                ) {

                    closeEditModal();
                }
            }
        );
    }
}


/* =========================================
   START APPLICATION
========================================= */

async function initializeApp() {

    setupEventListeners();


    const authenticated =
        await checkAuthentication();


    if (!authenticated) {
        return;
    }


    resetUploadForm();


    await loadMemories();
}


initializeApp();