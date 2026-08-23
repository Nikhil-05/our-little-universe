/* =========================================================
   OUR LITTLE UNIVERSE
   COMPLETE APP.JS
========================================================= */


/* =========================================================
   IMPORTS
========================================================= */

import { FFmpeg } from "@ffmpeg/ffmpeg";

import {
    fetchFile,
    toBlobURL
} from "@ffmpeg/util";

import coreURL from "@ffmpeg/core?url";

import wasmURL from "@ffmpeg/core/wasm?url";


/* =========================================================
   SUPABASE
========================================================= */

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================================
   STATE
========================================================= */

let currentUser = null;

let selectedFiles = [];

let currentEditingMemory = null;

let ffmpegInstance = null;

let ffmpegLoadingPromise = null;


/* =========================================================
   CONSTANTS
========================================================= */

const allowedTypes = [

    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",

    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-matroska"

];


const MAX_IMAGE_INPUT_SIZE =
    50 * 1024 * 1024;


const MAX_VIDEO_INPUT_SIZE =
    1024 *
    1024 *
    1024;


const MAX_STORED_MEDIA_SIZE =
    50 * 1024 * 1024;


/* =========================================================
   GENERIC HELPERS
========================================================= */

function getPageUrl(
    fileName
) {

    return new URL(
        `./${fileName}`,
        window.location.href
    ).href;
}


function formatFileSize(
    bytes
) {

    if (
        !Number.isFinite(bytes) ||
        bytes <= 0
    ) {

        return "0 KB";
    }


    if (
        bytes < 1024
    ) {

        return `${bytes} B`;
    }


    if (
        bytes <
        1024 * 1024
    ) {

        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;
    }


    if (
        bytes <
        1024 * 1024 * 1024
    ) {

        return `${(
            bytes /
            (1024 * 1024)
        ).toFixed(1)} MB`;
    }


    return `${(
        bytes /
        (1024 * 1024 * 1024)
    ).toFixed(2)} GB`;
}


function replaceExtension(
    fileName,
    extension
) {

    const dot =
        fileName.lastIndexOf(
            "."
        );


    if (
        dot === -1
    ) {

        return (
            `${fileName}.${extension}`
        );
    }


    return (
        `${fileName.substring(
            0,
            dot
        )}.${extension}`
    );
}


function escapeHtml(
    value
) {

    return String(
        value
    )

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


function escapeIlikePattern(
    value
) {

    return String(
        value
    )

        .replaceAll(
            "\\",
            "\\\\"
        )

        .replaceAll(
            "%",
            "\\%"
        )

        .replaceAll(
            "_",
            "\\_"
        );
}


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

            day:
                "numeric",

            month:
                "long",

            year:
                "numeric"

        }
    );
}


function formatEditedDate(
    timestamp
) {

    if (
        !timestamp
    ) {

        return "";
    }


    return new Date(
        timestamp
    ).toLocaleString(
        "en-IN",
        {

            day:
                "numeric",

            month:
                "short",

            year:
                "numeric",

            hour:
                "numeric",

            minute:
                "2-digit"

        }
    );
}


function isEdited(
    createdAt,
    updatedAt
) {

    if (
        !createdAt ||
        !updatedAt
    ) {

        return false;
    }


    return (
        new Date(
            updatedAt
        ).getTime() >

        new Date(
            createdAt
        ).getTime() +

        1000
    );
}


/* =========================================================
   AUTHENTICATION
========================================================= */

async function checkAuthentication() {

    const {
        data: {
            session
        },
        error
    } =
        await supabaseClient.auth.getSession();


    if (
        error
    ) {

        console.error(
            "Authentication error:",
            error
        );


        window.location.href =
            getPageUrl(
                "login.html"
            );


        return false;
    }


    if (
        !session
    ) {

        window.location.href =
            getPageUrl(
                "login.html"
            );


        return false;
    }


    currentUser =
        session.user;


    return true;
}


async function logout() {

    const {
        error
    } =
        await supabaseClient.auth.signOut();


    if (
        error
    ) {

        console.error(
            "Logout error:",
            error
        );


        return;
    }


    window.location.href =
        getPageUrl(
            "login.html"
        );
}


/* =========================================================
   UPLOAD MODAL
========================================================= */

function openModal() {

    const modal =
        document.getElementById(
            "uploadModal"
        );


    if (
        !modal
    ) {

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


    if (
        !modal
    ) {

        return;
    }


    modal.classList.add(
        "hidden"
    );


    document.body.style.overflow =
        "";


    resetUploadForm();
}


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


    if (
        title
    ) {

        title.value =
            "";
    }


    if (
        date
    ) {

        date.value =
            new Date()
                .toISOString()
                .split("T")[0];
    }


    if (
        description
    ) {

        description.value =
            "";
    }


    if (
        input
    ) {

        input.value =
            "";
    }


    if (
        preview
    ) {

        preview.innerHTML =
            "";
    }


    if (
        message
    ) {

        message.textContent =
            "";
    }


    if (
        saveButton
    ) {

        saveButton.disabled =
            false;


        saveButton.textContent =
            "Save Memory ❤️";
    }


    selectedFiles =
        [];
}


/* =========================================================
   FILE VALIDATION
========================================================= */

function validateFile(
    file
) {

    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        return {

            valid:
                false,

            message:
                `${file.name} is not a supported file type.`

        };
    }


    if (

        file.type.startsWith(
            "image/"
        ) &&

        file.size >
            MAX_IMAGE_INPUT_SIZE

    ) {

        return {

            valid:
                false,

            message:
                `${file.name} is larger than 50 MB.`

        };
    }


    if (

        file.type.startsWith(
            "video/"
        ) &&

        file.size >
            MAX_VIDEO_INPUT_SIZE

    ) {

        return {

            valid:
                false,

            message:
                `${file.name} is larger than 1 GB. Please trim it before uploading.`

        };
    }


    return {

        valid:
            true

    };
}


function addFiles(
    files
) {

    const uploadMessage =
        document.getElementById(
            "uploadMessage"
        );


    for (
        const file of Array.from(
            files || []
        )
    ) {

        const validation =
            validateFile(
                file
            );


        if (
            !validation.valid
        ) {

            if (
                uploadMessage
            ) {

                uploadMessage.textContent =
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


function renderPreviews() {

    const preview =
        document.getElementById(
            "uploadPreview"
        );


    if (
        !preview
    ) {

        return;
    }


    preview.innerHTML =
        "";


    selectedFiles.forEach(
        (
            file
        ) => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "preview-item";


            const url =
                URL.createObjectURL(
                    file
                );


            let visual;


            if (
                file.type.startsWith(
                    "image/"
                )
            ) {

                visual =
                    document.createElement(
                        "img"
                    );


                visual.src =
                    url;


                visual.alt =
                    file.name;

            } else {

                visual =
                    document.createElement(
                        "video"
                    );


                visual.src =
                    url;


                visual.muted =
                    true;


                visual.preload =
                    "metadata";
            }


            item.appendChild(
                visual
            );


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


            item.appendChild(
                badge
            );


            const size =
                document.createElement(
                    "small"
                );


            size.className =
                "preview-size";


            size.textContent =
                formatFileSize(
                    file.size
                );


            item.appendChild(
                size
            );


            preview.appendChild(
                item
            );
        }
    );
}


/* =========================================================
   IMAGE COMPRESSION
========================================================= */

async function compressImage(
    file
) {

    const bitmap =
        await createImageBitmap(
            file
        );


    const MAX_DIMENSION =
        1600;


    let width =
        bitmap.width;


    let height =
        bitmap.height;


    if (

        width >
            MAX_DIMENSION ||

        height >
            MAX_DIMENSION

    ) {

        const scale =
            Math.min(

                MAX_DIMENSION /
                    width,

                MAX_DIMENSION /
                    height

            );


        width =
            Math.round(
                width *
                scale
            );


        height =
            Math.round(
                height *
                scale
            );
    }


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        width;


    canvas.height =
        height;


    const context =
        canvas.getContext(
            "2d"
        );


    if (
        !context
    ) {

        bitmap.close();


        throw new Error(
            "Could not create image canvas."
        );
    }


    context.imageSmoothingEnabled =
        true;


    context.imageSmoothingQuality =
        "high";


    context.drawImage(
        bitmap,
        0,
        0,
        width,
        height
    );


    bitmap.close();


    const webpBlob =
        await new Promise(
            (
                resolve
            ) => {

                canvas.toBlob(
                    resolve,
                    "image/webp",
                    0.72
                );
            }
        );


    if (
        !webpBlob
    ) {

        throw new Error(
            "Image compression failed."
        );
    }


    if (
        webpBlob.size >=
            file.size
    ) {

        const jpegBlob =
            await new Promise(
                (
                    resolve
                ) => {

                    canvas.toBlob(
                        resolve,
                        "image/jpeg",
                        0.70
                    );
                }
            );


        if (

            jpegBlob &&

            jpegBlob.size <
                webpBlob.size

        ) {

            return new File(

                [
                    jpegBlob
                ],

                replaceExtension(
                    file.name,
                    "jpg"
                ),

                {

                    type:
                        "image/jpeg",

                    lastModified:
                        Date.now()

                }

            );
        }
    }


    return new File(

        [
            webpBlob
        ],

        replaceExtension(
            file.name,
            "webp"
        ),

        {

            type:
                "image/webp",

            lastModified:
                Date.now()

        }

    );
}


/* =========================================================
   FFMPEG
========================================================= */

async function loadFFmpeg(
    statusCallback
) {

    if (
        ffmpegInstance
    ) {

        return ffmpegInstance;
    }


    if (
        ffmpegLoadingPromise
    ) {

        return ffmpegLoadingPromise;
    }


    ffmpegLoadingPromise =
        (async () => {

            if (
                statusCallback
            ) {

                statusCallback(
                    "Loading video optimizer... ❤️"
                );
            }


            const ffmpeg =
                new FFmpeg();


            ffmpeg.on(
                "log",
                (
                    {
                        message
                    }
                ) => {

                    console.log(
                        "[FFmpeg]",
                        message
                    );
                }
            );


            ffmpeg.on(
                "progress",
                (
                    {
                        progress
                    }
                ) => {

                    if (

                        statusCallback &&

                        Number.isFinite(
                            progress
                        )

                    ) {

                        statusCallback(
                            `Compressing video... ${Math.round(
                                progress * 100
                            )}%`
                        );
                    }
                }
            );


            await ffmpeg.load({

                coreURL:
                    await toBlobURL(
                        coreURL,
                        "text/javascript"
                    ),

                wasmURL:
                    await toBlobURL(
                        wasmURL,
                        "application/wasm"
                    )

            });


            ffmpegInstance =
                ffmpeg;


            if (
                statusCallback
            ) {

                statusCallback(
                    "Video optimizer ready ❤️"
                );
            }


            return ffmpeg;

        })();


    try {

        return await ffmpegLoadingPromise;

    } catch (
        error
    ) {

        ffmpegLoadingPromise =
            null;


        ffmpegInstance =
            null;


        console.error(
            "FFmpeg initialization failed:",
            error
        );


        throw error;
    }
}


async function cleanupFFmpegFile(
    ffmpeg,
    fileName
) {

    try {

        if (
            typeof ffmpeg.deleteFile ===
            "function"
        ) {

            await ffmpeg.deleteFile(
                fileName
            );
        }

    } catch (
        error
    ) {

        console.warn(
            `FFmpeg cleanup failed for ${fileName}:`,
            error
        );
    }
}


async function compressVideo(
    file,
    statusCallback
) {

    if (
        file.size >
            MAX_VIDEO_INPUT_SIZE
    ) {

        throw new Error(
            "This video is larger than 1 GB. Please trim it before uploading."
        );
    }


    const ffmpeg =
        await loadFFmpeg(
            statusCallback
        );


    const inputName =
        "input.mp4";


    const outputName =
        "optimized.mp4";


    try {

        statusCallback(
            `Preparing ${formatFileSize(
                file.size
            )} video...`
        );


        await ffmpeg.writeFile(
            inputName,
            await fetchFile(
                file
            )
        );


        statusCallback(
            "Compressing video... ❤️"
        );


        await ffmpeg.exec([

            "-i",
            inputName,

            "-vf",
            "scale=854:-2",

            "-c:v",
            "libx264",

            "-preset",
            "veryfast",

            "-crf",
            "29",

            "-maxrate",
            "900k",

            "-bufsize",
            "1800k",

            "-r",
            "24",

            "-c:a",
            "aac",

            "-b:a",
            "64k",

            "-movflags",
            "+faststart",

            outputName

        ]);


        statusCallback(
            "Finalizing optimized video..."
        );


        const outputData =
            await ffmpeg.readFile(
                outputName
            );


        const optimizedBlob =
            new Blob(
                [
                    outputData
                ],

                {
                    type:
                        "video/mp4"
                }
            );


        const optimizedFile =
            new File(

                [
                    optimizedBlob
                ],

                replaceExtension(
                    file.name,
                    "mp4"
                ),

                {

                    type:
                        "video/mp4",

                    lastModified:
                        Date.now()

                }

            );


        await cleanupFFmpegFile(
            ffmpeg,
            inputName
        );


        await cleanupFFmpegFile(
            ffmpeg,
            outputName
        );


        return optimizedFile;

    } catch (
        error
    ) {

        await cleanupFFmpegFile(
            ffmpeg,
            inputName
        );


        await cleanupFFmpegFile(
            ffmpeg,
            outputName
        );


        throw error;
    }
}


async function optimizeMedia(
    file,
    statusCallback
) {

    statusCallback(
        `Original size: ${formatFileSize(
            file.size
        )}`
    );


    if (
        file.type.startsWith(
            "image/"
        )
    ) {

        const optimized =
            await compressImage(
                file
            );


        statusCallback(
            `Photo optimized: ${formatFileSize(
                file.size
            )} → ${formatFileSize(
                optimized.size
            )}`
        );


        return optimized;
    }


    if (
        file.type.startsWith(
            "video/"
        )
    ) {

        const optimized =
            await compressVideo(
                file,
                statusCallback
            );


        statusCallback(
            `Video optimized: ${formatFileSize(
                file.size
            )} → ${formatFileSize(
                optimized.size
            )}`
        );


        return optimized;
    }


    throw new Error(
        "Unsupported media type."
    );
}


/* =========================================================
   CREATE MEMORY
========================================================= */

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
            "Upload form elements are missing."
        );


        return;
    }


    const title =
        titleInput.value.trim();


    const date =
        dateInput.value;


    const description =
        descriptionInput.value.trim();


    if (
        !title
    ) {

        message.textContent =
            "Give this memory a title ❤️";


        return;
    }


    if (
        !date
    ) {

        message.textContent =
            "Please choose the memory date.";


        return;
    }


    if (
        selectedFiles.length ===
        0
    ) {

        message.textContent =
            "Add at least one photo or video.";


        return;
    }


    if (
        !currentUser
    ) {

        message.textContent =
            "Your session has expired. Please log in again.";


        return;
    }


    saveButton.disabled =
        true;


    saveButton.textContent =
        "Saving our memory... ❤️";


    try {

        message.textContent =
            "Creating your memory... ❤️";


        const {
            data:
                memory,

            error:
                memoryError

        } =
            await supabaseClient

                .from(
                    "memories"
                )

                .insert({

                    title,

                    description:
                        description ||
                        null,

                    memory_date:
                        date,

                    created_by:
                        currentUser.id

                })

                .select()

                .single();


        if (
            memoryError
        ) {

            throw memoryError;
        }


        for (
            let index = 0;
            index <
                selectedFiles.length;
            index++
        ) {

            const originalFile =
                selectedFiles[
                    index
                ];


            const position =
                index + 1;


            let optimizedFile;


            try {

                optimizedFile =
                    await optimizeMedia(

                        originalFile,

                        (
                            status
                        ) => {

                            message.textContent =
                                `File ${position}/${selectedFiles.length}: ${status}`;

                        }

                    );

            } catch (
                error
            ) {

                throw new Error(
                    `Could not optimize ${originalFile.name}. ${error.message}`
                );
            }


            if (
                optimizedFile.size >
                    MAX_STORED_MEDIA_SIZE
            ) {

                throw new Error(
                    `${originalFile.name} is still ${formatFileSize(
                        optimizedFile.size
                    )} after optimization.`
                );
            }


            message.textContent =
                `Uploading optimized ${position} of ${selectedFiles.length}...`;


            const extension =
                optimizedFile.name
                    .split(".")
                    .pop()
                    .toLowerCase();


            const uniqueName =
                `${crypto.randomUUID()}.${extension}`;


            const folder =
                optimizedFile.type.startsWith(
                    "video/"
                )
                    ? "videos"
                    : "photos";


            const filePath =
                `${currentUser.id}/${memory.id}/${folder}/${uniqueName}`;


            const {
                error:
                    uploadError

            } =
                await supabaseClient

                    .storage

                    .from(
                        "memory-media"
                    )

                    .upload(
                        filePath,
                        optimizedFile,
                        {

                            contentType:
                                optimizedFile.type,

                            cacheControl:
                                "31536000",

                            upsert:
                                false

                        }
                    );


            if (
                uploadError
            ) {

                throw uploadError;
            }


            const {
                error:
                    mediaError

            } =
                await supabaseClient

                    .from(
                        "media"
                    )

                    .insert({

                        memory_id:
                            memory.id,

                        file_name:
                            optimizedFile.name,

                        file_path:
                            filePath,

                        media_type:
                            optimizedFile.type.startsWith(
                                "video/"
                            )
                                ? "video"
                                : "image",

                        created_by:
                            currentUser.id

                    });


            if (
                mediaError
            ) {

                throw mediaError;
            }
        }


        message.textContent =
            "Memory saved ❤️";


        await new Promise(
            (
                resolve
            ) =>
                setTimeout(
                    resolve,
                    700
                )
        );


        closeModal();


        await loadMemories();

    } catch (
        error
    ) {

        console.error(
            "Create memory error:",
            error
        );


        message.textContent =
            error?.message ||
            "Something went wrong while saving this memory.";


        saveButton.disabled =
            false;


        saveButton.textContent =
            "Save Memory ❤️";
    }
}


/* =========================================================
   LOAD MEMORIES
========================================================= */

async function loadMemories() {

    const timeline =
        document.getElementById(
            "timeline"
        );


    if (
        !timeline
    ) {

        return;
    }


    timeline.innerHTML =
        `
        <div class="loading-state">

            <div class="loading-heart">
                ❤️
            </div>

            <p>
                Loading our memories...
            </p>

        </div>
    `;


    const searchInput =
        document.getElementById(
            "memorySearchInput"
        );


    const hash =
        window.location.hash;


    /*
     * A notification target should always
     * show the complete timeline, regardless
     * of a previous search.
     */

    if (
        hash.startsWith(
            "#memory-"
        ) &&
        searchInput
    ) {

        searchInput.value =
            "";


        document
            .getElementById(
                "clearSearchButton"
            )
            ?.classList.add(
                "hidden"
            );
    }


    const searchTerm =
        hash.startsWith(
            "#memory-"
        )

            ? ""

            : (
                searchInput
                    ?.value
                    .trim() ||
                ""
            );


    let query =
        supabaseClient

            .from(
                "memories"
            )

            .select(`
                id,
                title,
                description,
                memory_date,
                created_by,
                created_at,
                updated_at,
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
                    ascending:
                        false
                }
            );


    if (
        searchTerm
    ) {

        query =
            query.ilike(

                "title",

                `%${escapeIlikePattern(
                    searchTerm
                )}%`

            );
    }


    const {
        data:
            memories,

        error:
            memoriesError

    } =
        await query;


    if (
        memoriesError
    ) {

        console.error(
            "Error loading memories:",
            memoriesError
        );


        timeline.innerHTML =
            `
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
        memories.length ===
            0
    ) {

        timeline.innerHTML =
            searchTerm

                ? `
                    <div class="empty-state">

                        <div class="empty-heart">
                            🔍
                        </div>

                        <h2>
                            No memories found.
                        </h2>

                        <p>
                            Nothing matches
                            "<strong>${escapeHtml(
                                searchTerm
                            )}</strong>"
                            in the title.
                        </p>

                    </div>
                `

                : `
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


    /* =====================================================
       LOAD COMMENTS
       comments.media_id is your real schema
    ===================================================== */

    const mediaIds =
        [];


    for (
        const memory of memories
    ) {

        memory.media =
            memory.media ||
            [];


        for (
            const media of
                memory.media
        ) {

            media.comments =
                [];


            mediaIds.push(
                media.id
            );
        }
    }


    if (
        mediaIds.length
    ) {

        const {
            data:
                comments,

            error:
                commentsError

        } =
            await supabaseClient

                .from(
                    "comments"
                )

                .select(`
                    id,
                    media_id,
                    user_id,
                    comment_text,
                    parent_comment_id,
                    created_at,
                    updated_at
                `)

                .in(
                    "media_id",
                    mediaIds
                )

                .order(
                    "created_at",
                    {
                        ascending:
                            true
                    }
                );


        if (
            commentsError
        ) {

            console.warn(
                "Comments could not be loaded:",
                commentsError
            );

        } else {

            const allComments =
                comments ||
                [];


            for (
                const memory of memories
            ) {

                for (
                    const media of
                        memory.media
                ) {

                    media.comments =
                        allComments.filter(
                            (
                                comment
                            ) =>
                                comment.media_id ===
                                media.id
                        );
                }
            }
        }
    }


    /* =====================================================
       RENDER
    ===================================================== */

    timeline.innerHTML =
        "";


    /*
     * IMPORTANT:
     * This is the ONLY render loop.
     */

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


    /*
     * IMPORTANT:
     * Run AFTER the cards exist in the DOM.
     */

    focusMemoryFromHash();
}


/* =========================================================
   NOTIFICATION TARGET
========================================================= */

function focusMemoryFromHash() {

    const hash =
        window.location.hash;


    if (
        !hash.startsWith(
            "#memory-"
        )
    ) {

        return;
    }


    const hashValue =
        hash.substring(
            1
        );


    const marker =
        "-comment-";


    const markerIndex =
        hashValue.indexOf(
            marker
        );


    let memoryId;

    let commentId =
        null;


    if (
        markerIndex !==
        -1
    ) {

        memoryId =
            hashValue.substring(
                "memory-".length,
                markerIndex
            );


        commentId =
            hashValue.substring(
                markerIndex +
                marker.length
            );

    } else {

        memoryId =
            hashValue.substring(
                "memory-".length
            );
    }


    if (
        !memoryId
    ) {

        return;
    }


    const memory =
        document.getElementById(
            `memory-${memoryId}`
        );


    if (
        !memory
    ) {

        console.warn(
            "Notification memory not found:",
            memoryId
        );


        return;
    }


    memory.scrollIntoView({

        behavior:
            "smooth",

        block:
            "center"

    });


    memory.classList.add(
        "memory-notification-highlight"
    );


    setTimeout(
        () => {

            memory.classList.remove(
                "memory-notification-highlight"
            );

        },
        2500
    );


    if (
        commentId
    ) {

        setTimeout(
            () => {

                const comment =
                    document.getElementById(
                        `comment-${commentId}`
                    );


                if (
                    !comment
                ) {

                    console.warn(
                        "Notification comment not found:",
                        commentId
                    );


                    return;
                }


                comment.scrollIntoView({

                    behavior:
                        "smooth",

                    block:
                        "center"

                });


                comment.classList.add(
                    "comment-notification-highlight"
                );


                setTimeout(
                    () => {

                        comment.classList.remove(
                            "comment-notification-highlight"
                        );

                    },
                    2500
                );

            },
            550
        );
    }
}


/* =========================================================
   SIGNED URL
========================================================= */

async function getSignedMediaUrl(
    filePath
) {

    const {
        data,
        error
    } =
        await supabaseClient

            .storage

            .from(
                "memory-media"
            )

            .createSignedUrl(
                filePath,
                60 * 60 * 24
            );


    if (
        error
    ) {

        console.error(
            "Signed URL error:",
            error
        );


        return null;
    }


    return (
        data?.signedUrl ||
        null
    );
}


/* =========================================================
   MEMORY CARD
========================================================= */

async function createMemoryElement(
    memory
) {

    const article =
        document.createElement(
            "article"
        );


    /*
     * Notification target
     */

    article.id =
        `memory-${memory.id}`;


    article.className =
        "memory-card";


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


    const edited =
        isEdited(
            memory.created_at,
            memory.updated_at
        );


    info.innerHTML =
        `
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

        ${
            edited
                ? `
                    <div class="memory-edited-label">
                        Edited · ${formatEditedDate(
                            memory.updated_at
                        )}
                    </div>
                  `
                : ""
        }
    `;


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


    actions.append(
        editButton,
        deleteButton
    );


    header.append(
        info,
        actions
    );


    article.appendChild(
        header
    );


    if (
        memory.description
    ) {

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


    const mediaItems =
        memory.media ||
        [];


    if (
        mediaItems.length
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


            if (
                !signedUrl
            ) {

                continue;
            }


            grid.appendChild(
                createMediaElement(
                    media,
                    signedUrl
                )
            );
        }


        if (
            grid.children.length
        ) {

            article.appendChild(
                grid
            );
        }
    }


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


    editButton.addEventListener(
        "click",
        (
            event
        ) => {

            event.preventDefault();


            event.stopPropagation();


            openEditModal(
                memory
            );
        }
    );


    deleteButton.addEventListener(
        "click",
        (
            event
        ) => {

            event.preventDefault();


            event.stopPropagation();


            deleteMemory(
                memory
            );
        }
    );


    return article;
}


/* =========================================================
   MEDIA
========================================================= */

function createMediaElement(
    media,
    signedUrl
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "media-wrapper";


    const mediaItem =
        document.createElement(
            "div"
        );


    mediaItem.className =
        "media-item";


    if (
        media.media_type ===
        "image"
    ) {

        const image =
            document.createElement(
                "img"
            );


        image.src =
            signedUrl;


        image.alt =
            media.file_name ||
            "Memory photo";


        image.loading =
            "lazy";


        mediaItem.appendChild(
            image
        );

    } else if (
        media.media_type ===
        "video"
    ) {

        mediaItem.classList.add(
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


        mediaItem.appendChild(
            video
        );
    }


    wrapper.appendChild(
        mediaItem
    );


    wrapper.appendChild(
        createCommentsSection(
            media
        )
    );


    return wrapper;
}


/* =========================================================
   COMMENTS SECTION
========================================================= */

function createCommentsSection(
    media
) {

    const section =
        document.createElement(
            "div"
        );


    section.className =
        "comments-section";


    const comments =
        media.comments ||
        [];


    const header =
        document.createElement(
            "div"
        );


    header.className =
        "comments-header";


    header.textContent =
        comments.length
            ? `❤️ Comments (${comments.length})`
            : "❤️ Comments";


    section.appendChild(
        header
    );


    const list =
        document.createElement(
            "div"
        );


    list.className =
        "comments-list";


    const roots =
        comments.filter(
            (
                comment
            ) =>
                !comment.parent_comment_id
        );


    roots.forEach(
        (
            comment
        ) => {

            list.appendChild(
                createCommentElement(
                    comment,
                    comments,
                    media.id
                )
            );
        }
    );


    section.appendChild(
        list
    );


    const inputArea =
        document.createElement(
            "div"
        );


    inputArea.className =
        "comment-input-area";


    const input =
        document.createElement(
            "input"
        );


    input.type =
        "text";


    input.className =
        "comment-input";


    input.placeholder =
        "Write something... ❤️";


    input.maxLength =
        500;


    const button =
        document.createElement(
            "button"
        );


    button.type =
        "button";


    button.className =
        "comment-button";


    button.textContent =
        "Post";


    button.addEventListener(
        "click",
        () => {

            addComment(
                media.id,
                input.value,
                null,
                input,
                button
            );
        }
    );


    input.addEventListener(
        "keydown",
        (
            event
        ) => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();


                addComment(
                    media.id,
                    input.value,
                    null,
                    input,
                    button
                );
            }
        }
    );


    inputArea.append(
        input,
        button
    );


    section.appendChild(
        inputArea
    );


    return section;
}


/* =========================================================
   COMMENT ELEMENT
========================================================= */

function createCommentElement(
    comment,
    allComments,
    mediaId
) {

    const container =
        document.createElement(
            "div"
        );


    /*
     * Notification target
     */

    container.id =
        `comment-${comment.id}`;


    container.className =
        "comment-container";


    const bubble =
        document.createElement(
            "div"
        );


    bubble.className =
        "comment-bubble";


    const header =
        document.createElement(
            "div"
        );


    header.className =
        "comment-header";


    const author =
        document.createElement(
            "div"
        );


    author.className =
        "comment-author";


    author.textContent =
        getCommentAuthor(
            comment.user_id
        );


    const actions =
        document.createElement(
            "div"
        );


    actions.className =
        "comment-actions";


    if (
        currentUser &&
        comment.user_id ===
            currentUser.id
    ) {

        const editButton =
            document.createElement(
                "button"
            );


        editButton.type =
            "button";


        editButton.className =
            "comment-action-button edit-comment-button";


        editButton.textContent =
            "Edit";


        editButton.addEventListener(
            "click",
            () => {

                startEditComment(
                    comment,
                    bubble
                );
            }
        );


        const deleteButton =
            document.createElement(
                "button"
            );


        deleteButton.type =
            "button";


        deleteButton.className =
            "comment-action-button delete-comment-button";


        deleteButton.textContent =
            "Delete";


        deleteButton.addEventListener(
            "click",
            () => {

                deleteComment(
                    comment.id
                );
            }
        );


        actions.append(
            editButton,
            deleteButton
        );
    }


    const replyButton =
        document.createElement(
            "button"
        );


    replyButton.type =
        "button";


    replyButton.className =
        "reply-button";


    replyButton.textContent =
        "Reply";


    actions.appendChild(
        replyButton
    );


    header.append(
        author,
        actions
    );


    bubble.appendChild(
        header
    );


    const text =
        document.createElement(
            "div"
        );


    text.className =
        "comment-text";


    text.textContent =
        comment.comment_text;


    bubble.appendChild(
        text
    );


    /*
     * Edited indicator
     */

    if (
        isEdited(
            comment.created_at,
            comment.updated_at
        )
    ) {

        const editedLabel =
            document.createElement(
                "div"
            );


        editedLabel.className =
            "comment-edited-label";


        editedLabel.textContent =
            `Edited · ${formatEditedDate(
                comment.updated_at
            )}`;


        bubble.appendChild(
            editedLabel
        );
    }


    container.appendChild(
        bubble
    );


    /* =====================================================
       REPLIES
    ===================================================== */

    const repliesContainer =
        document.createElement(
            "div"
        );


    repliesContainer.className =
        "replies-container";


    const replies =
        allComments.filter(
            (
                item
            ) =>
                item.parent_comment_id ===
                comment.id
        );


    replies.forEach(
        (
            reply
        ) => {

            repliesContainer.appendChild(
                createCommentElement(
                    reply,
                    allComments,
                    mediaId
                )
            );
        }
    );


    container.appendChild(
        repliesContainer
    );


    /* =====================================================
       REPLY INPUT
    ===================================================== */

    replyButton.addEventListener(
        "click",
        () => {

            const existing =
                container.querySelector(
                    ".reply-input-area"
                );


            if (
                existing
            ) {

                existing.remove();


                return;
            }


            const replyArea =
                document.createElement(
                    "div"
                );


            replyArea.className =
                "reply-input-area";


            const input =
                document.createElement(
                    "input"
                );


            input.type =
                "text";


            input.className =
                "comment-input";


            input.placeholder =
                "Write a reply... ❤️";


            input.maxLength =
                500;


            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "comment-button";


            button.textContent =
                "Reply";


            button.addEventListener(
                "click",
                () => {

                    addComment(
                        mediaId,
                        input.value,
                        comment.id,
                        input,
                        button
                    );
                }
            );


            input.addEventListener(
                "keydown",
                (
                    event
                ) => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();


                        addComment(
                            mediaId,
                            input.value,
                            comment.id,
                            input,
                            button
                        );
                    }
                }
            );


            replyArea.append(
                input,
                button
            );


            container.insertBefore(
                replyArea,
                repliesContainer
            );


            input.focus();
        }
    );


    return container;
}


function getCommentAuthor(
    userId
) {

    if (
        currentUser &&
        userId ===
            currentUser.id
    ) {

        return "You";
    }


    return "Your love ❤️";
}


/* =========================================================
   ADD COMMENT / REPLY
========================================================= */

async function addComment(
    mediaId,
    text,
    parentCommentId,
    inputElement,
    buttonElement
) {

    const commentText =
        String(
            text || ""
        ).trim();


    if (
        !commentText ||
        !currentUser
    ) {

        return;
    }


    buttonElement.disabled =
        true;


    buttonElement.textContent =
        parentCommentId
            ? "Replying..."
            : "Posting...";


    try {

        const {
            error
        } =
            await supabaseClient

                .from(
                    "comments"
                )

                .insert({

                    media_id:
                        mediaId,

                    user_id:
                        currentUser.id,

                    comment_text:
                        commentText,

                    parent_comment_id:
                        parentCommentId ||
                        null

                });


        if (
            error
        ) {

            throw error;
        }


        inputElement.value =
            "";


        await loadMemories();

    } catch (
        error
    ) {

        console.error(
            "Comment error:",
            error
        );


        alert(
            error?.message ||
            "Couldn't post the comment."
        );

    } finally {

        buttonElement.disabled =
            false;


        buttonElement.textContent =
            parentCommentId
                ? "Reply"
                : "Post";
    }
}


/* =========================================================
   EDIT COMMENT
========================================================= */

async function startEditComment(
    comment,
    bubble
) {

    if (
        bubble.querySelector(
            ".edit-comment-area"
        )
    ) {

        return;
    }


    const existingText =
        bubble.querySelector(
            ".comment-text"
        );


    if (
        !existingText
    ) {

        return;
    }


    existingText.style.display =
        "none";


    const editArea =
        document.createElement(
            "div"
        );


    editArea.className =
        "edit-comment-area";


    const input =
        document.createElement(
            "textarea"
        );


    input.className =
        "comment-edit-input";


    input.value =
        comment.comment_text;


    input.maxLength =
        500;


    const controls =
        document.createElement(
            "div"
        );


    controls.className =
        "comment-edit-controls";


    const saveButton =
        document.createElement(
            "button"
        );


    saveButton.type =
        "button";


    saveButton.className =
        "comment-button";


    saveButton.textContent =
        "Save";


    const cancelButton =
        document.createElement(
            "button"
        );


    cancelButton.type =
        "button";


    cancelButton.className =
        "comment-action-button";


    cancelButton.textContent =
        "Cancel";


    controls.append(
        saveButton,
        cancelButton
    );


    editArea.append(
        input,
        controls
    );


    existingText.after(
        editArea
    );


    input.focus();


    input.setSelectionRange(
        input.value.length,
        input.value.length
    );


    cancelButton.addEventListener(
        "click",
        () => {

            editArea.remove();


            existingText.style.display =
                "";
        }
    );


    saveButton.addEventListener(
        "click",
        async () => {

            const newText =
                input.value.trim();


            if (
                !newText
            ) {

                alert(
                    "Comment cannot be empty."
                );


                input.focus();


                return;
            }


            if (
                newText ===
                comment.comment_text
            ) {

                editArea.remove();


                existingText.style.display =
                    "";


                return;
            }


            saveButton.disabled =
                true;


            saveButton.textContent =
                "Saving...";


            try {

                const {
                    error
                } =
                    await supabaseClient

                        .from(
                            "comments"
                        )

                        .update({

                            comment_text:
                                newText

                        })

                        .eq(
                            "id",
                            comment.id
                        )

                        .eq(
                            "user_id",
                            currentUser.id
                        );


                if (
                    error
                ) {

                    throw error;
                }


                await loadMemories();

            } catch (
                error
            ) {

                console.error(
                    "Edit comment error:",
                    error
                );


                alert(
                    error?.message ||
                    "Couldn't update the comment."
                );


                saveButton.disabled =
                    false;


                saveButton.textContent =
                    "Save";
            }
        }
    );
}


/* =========================================================
   DELETE COMMENT
========================================================= */

async function deleteComment(
    commentId
) {

    if (
        !window.confirm(
            "Delete this comment?"
        )
    ) {

        return;
    }


    try {

        const {
            error
        } =
            await supabaseClient

                .from(
                    "comments"
                )

                .delete()

                .eq(
                    "id",
                    commentId
                )

                .eq(
                    "user_id",
                    currentUser.id
                );


        if (
            error
        ) {

            throw error;
        }


        await loadMemories();

    } catch (
        error
    ) {

        console.error(
            "Delete comment error:",
            error
        );


        alert(
            error?.message ||
            "Couldn't delete the comment."
        );
    }
}


/* =========================================================
   MEMORY EDIT MODAL
========================================================= */

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
            "Edit modal is missing required elements."
        );


        return;
    }


    currentEditingMemory =
        memory;


    titleInput.value =
        memory.title ||
        "";


    dateInput.value =
        memory.memory_date ||
        "";


    descriptionInput.value =
        memory.description ||
        "";


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


    titleInput.focus();
}


function closeEditModal() {

    const modal =
        document.getElementById(
            "editModal"
        );


    if (
        !modal
    ) {

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


async function updateMemory() {

    if (
        !currentEditingMemory
    ) {

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


    const title =
        titleInput.value.trim();


    const date =
        dateInput.value;


    const description =
        descriptionInput.value.trim();


    if (
        !title
    ) {

        message.textContent =
            "Please give the memory a title.";


        return;
    }


    if (
        !date
    ) {

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
        } =
            await supabaseClient

                .from(
                    "memories"
                )

                .update({

                    title,

                    memory_date:
                        date,

                    description:
                        description ||
                        null

                })

                .eq(
                    "id",
                    currentEditingMemory.id
                );


        if (
            error
        ) {

            throw error;
        }


        message.textContent =
            "Changes saved ❤️";


        await new Promise(
            (
                resolve
            ) =>
                setTimeout(
                    resolve,
                    500
                )
        );


        closeEditModal();


        await loadMemories();

    } catch (
        error
    ) {

        console.error(
            "Update memory error:",
            error
        );


        message.textContent =
            error?.message ||
            "Couldn't save the changes.";


        saveButton.disabled =
            false;


        saveButton.textContent =
            "Save Changes ❤️";
    }
}


/* =========================================================
   DELETE MEMORY
========================================================= */

async function deleteMemory(
    memory
) {

    if (
        !window.confirm(

            `Delete "${memory.title}"?` +

            `\n\nThis will permanently delete the memory and all of its photos/videos.`

        )
    ) {

        return;
    }


    try {

        const {
            data:
                mediaItems,

            error:
                fetchError

        } =
            await supabaseClient

                .from(
                    "media"
                )

                .select(
                    "id, file_path"
                )

                .eq(
                    "memory_id",
                    memory.id
                );


        if (
            fetchError
        ) {

            throw fetchError;
        }


        if (
            mediaItems?.length
        ) {

            const paths =
                mediaItems.map(
                    (
                        item
                    ) =>
                        item.file_path
                );


            const {
                error:
                    storageError

            } =
                await supabaseClient

                    .storage

                    .from(
                        "memory-media"
                    )

                    .remove(
                        paths
                    );


            if (
                storageError
            ) {

                throw storageError;
            }


            const mediaIds =
                mediaItems.map(
                    (
                        item
                    ) =>
                        item.id
                );


            const {
                error:
                    commentsError

            } =
                await supabaseClient

                    .from(
                        "comments"
                    )

                    .delete()

                    .in(
                        "media_id",
                        mediaIds
                    );


            if (
                commentsError
            ) {

                throw commentsError;
            }
        }


        const {
            error:
                mediaDeleteError

        } =
            await supabaseClient

                .from(
                    "media"
                )

                .delete()

                .eq(
                    "memory_id",
                    memory.id
                );


        if (
            mediaDeleteError
        ) {

            throw mediaDeleteError;
        }


        const {
            error:
                memoryDeleteError

        } =
            await supabaseClient

                .from(
                    "memories"
                )

                .delete()

                .eq(
                    "id",
                    memory.id
                );


        if (
            memoryDeleteError
        ) {

            throw memoryDeleteError;
        }


        await loadMemories();

    } catch (
        error
    ) {

        console.error(
            "Delete memory error:",
            error
        );


        alert(
            error?.message ||
            "Something went wrong while deleting this memory."
        );
    }
}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

    const searchInput =
        document.getElementById(
            "memorySearchInput"
        );


    const clearButton =
        document.getElementById(
            "clearSearchButton"
        );


    let searchTimeout =
        null;


    if (
        searchInput
    ) {

        searchInput.addEventListener(
            "input",
            () => {

                clearTimeout(
                    searchTimeout
                );


                const value =
                    searchInput.value.trim();


                clearButton?.classList.toggle(
                    "hidden",
                    value.length ===
                        0
                );


                searchTimeout =
                    setTimeout(
                        () => {

                            loadMemories();

                        },
                        300
                    );
            }
        );
    }


    if (
        clearButton
    ) {

        clearButton.addEventListener(
            "click",
            async () => {

                if (
                    searchInput
                ) {

                    searchInput.value =
                        "";
                }


                clearButton.classList.add(
                    "hidden"
                );


                await loadMemories();


                searchInput?.focus();
            }
        );
    }
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEventListeners() {

    setupSearch();


    document
        .getElementById(
            "logoutButton"
        )
        ?.addEventListener(
            "click",
            logout
        );


    document
        .getElementById(
            "openUploadButton"
        )
        ?.addEventListener(
            "click",
            openModal
        );


    document
        .getElementById(
            "closeUploadButton"
        )
        ?.addEventListener(
            "click",
            closeModal
        );


    document
        .getElementById(
            "saveMemoryButton"
        )
        ?.addEventListener(
            "click",
            createMemory
        );


    const uploadModal =
        document.getElementById(
            "uploadModal"
        );


    if (
        uploadModal
    ) {

        uploadModal.addEventListener(
            "click",
            (
                event
            ) => {

                if (
                    event.target ===
                    uploadModal
                ) {

                    closeModal();
                }
            }
        );
    }


    const dropZone =
        document.getElementById(
            "dropZone"
        );


    const mediaInput =
        document.getElementById(
            "mediaInput"
        );


    if (
        dropZone
    ) {

        dropZone.addEventListener(
            "click",
            () => {

                mediaInput?.click();
            }
        );


        dropZone.addEventListener(
            "dragover",
            (
                event
            ) => {

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
            (
                event
            ) => {

                event.preventDefault();


                dropZone.classList.remove(
                    "drag-over"
                );


                addFiles(
                    event
                        .dataTransfer
                        ?.files ||
                    []
                );
            }
        );
    }


    if (
        mediaInput
    ) {

        mediaInput.addEventListener(
            "change",
            () => {

                addFiles(
                    mediaInput.files ||
                    []
                );
            }
        );
    }


    document
        .getElementById(
            "closeEditButton"
        )
        ?.addEventListener(
            "click",
            (
                event
            ) => {

                event.preventDefault();


                closeEditModal();
            }
        );


    document
        .getElementById(
            "saveEditButton"
        )
        ?.addEventListener(
            "click",
            (
                event
            ) => {

                event.preventDefault();


                updateMemory();
            }
        );


    const editModal =
        document.getElementById(
            "editModal"
        );


    if (
        editModal
    ) {

        editModal.addEventListener(
            "click",
            (
                event
            ) => {

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


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeApp() {

    setupEventListeners();


    const authenticated =
        await checkAuthentication();


    if (
        !authenticated
    ) {

        return;
    }


    resetUploadForm();


    await loadMemories();
}


initializeApp();