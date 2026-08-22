/* =========================================
   SUPABASE CLIENT
========================================= */

import { FFmpeg } from "@ffmpeg/ffmpeg";

import {
    fetchFile,
    toBlobURL
} from "@ffmpeg/util";

import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================
   STATE
========================================= */

let currentUser = null;

let selectedFiles = [];

let currentEditingMemory = null;

let ffmpegInstance = null;

let ffmpegLoadingPromise = null;

let currentSearchTerm = "";


/* =========================================
   FILE CONFIGURATION
========================================= */

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


const MAX_UPLOAD_SIZE =
    50 * 1024 * 1024;


const MAX_VIDEO_PROCESSING_SIZE =
    1024 *
    1024 *
    1024;


/* =========================================
   AUTHENTICATION
========================================= */

async function checkAuthentication() {

    const {
        data: { session },
        error
    } =
        await supabaseClient.auth.getSession();


    if (error) {

        console.error(
            "Authentication error:",
            error
        );

        window.location.href =
            "./login.html";

        return false;
    }


    if (!session) {

        window.location.href =
            "./login.html";

        return false;
    }


    currentUser =
        session.user;


    return true;
}


/* =========================================
   LOGOUT
========================================= */

async function logout() {

    const {
        error
    } =
        await supabaseClient.auth.signOut();


    if (error) {

        console.error(
            "Logout error:",
            error
        );

        return;
    }


    window.location.href =
        "./login.html";
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

        title.value =
            "";
    }


    if (date) {

        date.value =
            new Date()
                .toISOString()
                .split("T")[0];
    }


    if (description) {

        description.value =
            "";
    }


    if (input) {

        input.value =
            "";
    }


    if (preview) {

        preview.innerHTML =
            "";
    }


    if (message) {

        message.textContent =
            "";
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
   FILE SIZE FORMATTER
========================================= */

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
        1024 *
        1024 *
        1024
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


/* =========================================
   FILE VALIDATION
========================================= */

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


    /* IMAGE */

    if (
        file.type.startsWith(
            "image/"
        )
    ) {

        if (
            file.size >
            MAX_UPLOAD_SIZE
        ) {

            return {

                valid:
                    false,

                message:
                    `${file.name} is too large to process safely.`
            };
        }


        return {

            valid:
                true
        };
    }


    /* VIDEO */

    if (
        file.type.startsWith(
            "video/"
        )
    ) {

        if (
            file.size >
            MAX_VIDEO_PROCESSING_SIZE
        ) {

            return {

                valid:
                    false,

                message:
                    `${file.name} is larger than 1 GB. Please trim the video before uploading.`
            };
        }


        return {

            valid:
                true
        };
    }


    return {

        valid:
            false,

        message:
            "Unsupported file type."
    };
}


/* =========================================
   ADD FILES
========================================= */

function addFiles(
    files
) {

    const incomingFiles =
        Array.from(
            files || []
        );


    for (
        const file of incomingFiles
    ) {

        const validation =
            validateFile(
                file
            );


        if (
            !validation.valid
        ) {

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


    preview.innerHTML =
        "";


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


                image.src =
                    url;


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


                video.src =
                    url;


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


            wrapper.appendChild(
                size
            );


            preview.appendChild(
                wrapper
            );
        }
    );
}


/* =========================================
   IMAGE COMPRESSION
========================================= */

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


    if (!context) {

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
            (resolve) => {

                canvas.toBlob(
                    resolve,
                    "image/webp",
                    0.72
                );
            }
        );


    if (!webpBlob) {

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
                (resolve) => {

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


/* =========================================
   REPLACE FILE EXTENSION
========================================= */

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

        return `${fileName}.${extension}`;
    }


    return (

        fileName.substring(
            0,
            dot
        ) +

        "." +

        extension

    );
}


/* =========================================
   LOAD FFMPEG
========================================= */

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
                ({ message }) => {

                    console.log(
                        "[FFmpeg]",
                        message
                    );
                }
            );


            ffmpeg.on(
                "progress",
                ({ progress }) => {

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

        console.error(
            "FFmpeg initialization failed:",
            error
        );


        ffmpegLoadingPromise =
            null;


        ffmpegInstance =
            null;


        throw error;
    }
}


/* =========================================
   CONVERT FILE TO UINT8ARRAY
========================================= */

async function fileToUint8Array(
    file
) {

    const buffer =
        await file.arrayBuffer();


    return new Uint8Array(
        buffer
    );
}


/* =========================================
   SAFE FFMPEG DELETE
========================================= */

async function cleanupFFmpegFile(
    ffmpeg,
    fileName
) {

    try {

        if (

            ffmpeg.fs &&

            typeof ffmpeg.fs.unlink ===
                "function"

        ) {

            ffmpeg.fs.unlink(
                fileName
            );


            return;
        }


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
            `Could not clean up ${fileName}:`,
            error
        );
    }
}


/* =========================================
   VIDEO COMPRESSION
========================================= */

async function compressVideo(
    file,
    statusCallback
) {

    const MAX_VIDEO_SIZE =
        1024 *
        1024 *
        1024;


    if (
        file.size >
        MAX_VIDEO_SIZE
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


        await ffmpeg.deleteFile(
            inputName
        );


        await ffmpeg.deleteFile(
            outputName
        );


        return optimizedFile;


    } catch (
        error
    ) {

        try {

            await ffmpeg.deleteFile(
                inputName
            );

        } catch (_) {}


        try {

            await ffmpeg.deleteFile(
                outputName
            );

        } catch (_) {}


        throw error;
    }
}


/* =========================================
   VIDEO EXTENSION
========================================= */

function getVideoExtension(
    mimeType
) {

    if (
        mimeType ===
        "video/webm"
    ) {

        return "webm";
    }


    if (
        mimeType ===
        "video/quicktime"
    ) {

        return "mov";
    }


    if (
        mimeType ===
        "video/x-matroska"
    ) {

        return "mkv";
    }


    return "mp4";
}


/* =========================================
   OPTIMIZE MEDIA
========================================= */

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


    try {

        message.textContent =
            "Creating your memory... ❤️";


        const {
            data: memory,
            error: memoryError
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
                selectedFiles[index];


            const position =
                index + 1;


            message.textContent =
                `Optimizing ${position} of ${selectedFiles.length}... ❤️`;


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

                console.error(
                    "Optimization failed:",
                    error
                );


                throw new Error(
                    `Could not optimize ${originalFile.name}. ${error.message}`
                );
            }


            if (
                optimizedFile.size >
                MAX_UPLOAD_SIZE
            ) {

                throw new Error(
                    `${originalFile.name} is still ${formatFileSize(
                        optimizedFile.size
                    )} after optimization, which is above the 50 MB upload limit.`
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


            console.log(

                `Optimized:
${originalFile.name}
${formatFileSize(
    originalFile.size
)}
→
${formatFileSize(
    optimizedFile.size
)}`

            );
        }


        message.textContent =
            "Memory saved ❤️";


        await new Promise(
            (
                resolve
            ) =>
                setTimeout(
                    resolve,
                    800
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
            error.message ||
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


    const searchTerm =
        searchInput

            ? searchInput.value.trim()

            : "";


    currentSearchTerm =
        searchTerm;


    let memoryQuery =
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
                media (
                    id,
                    file_name,
                    file_path,
                    media_type,
                    created_by,
                    created_at
                )
            `);


    if (
        searchTerm
    ) {

        const escapedSearch =
            escapeIlikePattern(
                searchTerm
            );


        memoryQuery =
            memoryQuery.ilike(
                "title",
                `%${escapedSearch}%`
            );
    }


    const {
        data: memories,
        error:
            memoriesError
    } =
        await memoryQuery.order(
            "memory_date",
            {
                ascending:
                    false
            }
        );


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
        memories.length === 0
    ) {

        if (
            searchTerm
        ) {

            timeline.innerHTML =
                `
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
            `;

        } else {

            timeline.innerHTML =
                `
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
        }


        return;
    }


    /* =====================================
       LOAD COMMENTS BY MEDIA
       
       IMPORTANT:
       comments table uses media_id
    ===================================== */

    const mediaIds = [];


    memories.forEach(
        (
            memory
        ) => {

            memory.media =
                memory.media ||
                [];


            memory.media.forEach(
                (
                    media
                ) => {

                    media.comments =
                        [];


                    mediaIds.push(
                        media.id
                    );
                }
            );
        }
    );


    if (
        mediaIds.length > 0
    ) {

        const {
            data: comments,
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
                    created_at
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
                "Comments could not be loaded. Memories will still be displayed:",
                commentsError
            );

        } else {

            const allComments =
                comments ||
                [];


            memories.forEach(
                (
                    memory
                ) => {

                    memory.media.forEach(
                        (
                            media
                        ) => {

                            media.comments =

                                allComments.filter(

                                    (
                                        comment
                                    ) =>

                                        comment.media_id ===
                                        media.id

                                );
                        }
                    );
                }
            );
        }
    }


    /* =====================================
       RENDER TIMELINE
    ===================================== */

    timeline.innerHTML =
        "";


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


    return data?.signedUrl ||
        null;
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


    article.id =
        `memory-${memory.id}`;


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


    /* MEDIA */

    const mediaItems =
        memory.media ||
        [];


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


            if (
                !signedUrl
            ) {

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


    /* EDIT */

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


    /* DELETE */

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
        "media-wrapper";


    const mediaItem =
        document.createElement(
            "div"
        );


    mediaItem.className =
        "media-item";


    /* IMAGE */

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


        image.addEventListener(
            "error",
            () => {

                console.warn(
                    "Image failed to load:",
                    media.file_path
                );
            }
        );


        mediaItem.appendChild(
            image
        );


    /* VIDEO */

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


    /* COMMENTS */

    const commentsSection =
        createCommentsSection(
            media
        );


    wrapper.appendChild(
        commentsSection
    );


    return wrapper;
}


/* =========================================
   COMMENTS SECTION
========================================= */

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
        comments.length > 0

            ? `❤️ Comments (${comments.length})`

            : "❤️ Comments";


    section.appendChild(
        header
    );


    const commentsList =
        document.createElement(
            "div"
        );


    commentsList.className =
        "comments-list";


    const rootComments =
        comments.filter(
            (
                comment
            ) =>
                !comment.parent_comment_id
        );


    rootComments.forEach(
        (
            comment
        ) => {

            commentsList.appendChild(

                createCommentElement(
                    comment,
                    comments,
                    media.id
                )

            );
        }
    );


    section.appendChild(
        commentsList
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
        async () => {

            await addComment(

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
        async (
            event
        ) => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();


                await addComment(

                    media.id,

                    input.value,

                    null,

                    input,

                    button

                );
            }
        }
    );


    inputArea.appendChild(
        input
    );


    inputArea.appendChild(
        button
    );


    section.appendChild(
        inputArea
    );


    return section;
}


/* =========================================
   COMMENT ELEMENT
========================================= */

function createCommentElement(
    comment,
    allComments,
    mediaId
) {

    const container =
        document.createElement(
            "div"
        );


    container.className =
        "comment-container";


    /* COMMENT BUBBLE */

    const bubble =
        document.createElement(
            "div"
        );


    bubble.className =
        "comment-bubble";


    /* HEADER */

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


    header.appendChild(
        author
    );


    /* ACTIONS */

    const actions =
        document.createElement(
            "div"
        );


    actions.className =
        "comment-actions";


    const isOwner =
        Boolean(

            currentUser &&

            comment.user_id ===
                currentUser.id

        );


    if (
        isOwner
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
            async () => {

                await deleteComment(
                    comment.id
                );
            }
        );


        actions.appendChild(
            editButton
        );


        actions.appendChild(
            deleteButton
        );
    }


    /* REPLY */

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


    header.appendChild(
        actions
    );


    bubble.appendChild(
        header
    );


    /* COMMENT TEXT */

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


    container.appendChild(
        bubble
    );


    /* REPLIES */

    const replies =
        allComments.filter(

            (
                item
            ) =>

                item.parent_comment_id ===
                comment.id

        );


    const repliesContainer =
        document.createElement(
            "div"
        );


    repliesContainer.className =
        "replies-container";


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


    /* REPLY INPUT */

    replyButton.addEventListener(
        "click",
        () => {

            const existingReplyBox =
                container.querySelector(
                    ".reply-input-area"
                );


            if (
                existingReplyBox
            ) {

                existingReplyBox.remove();

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
                async () => {

                    await addComment(

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
                async (
                    event
                ) => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();


                        await addComment(

                            mediaId,

                            input.value,

                            comment.id,

                            input,

                            button

                        );
                    }
                }
            );


            replyArea.appendChild(
                input
            );


            replyArea.appendChild(
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


/* =========================================
   EDIT COMMENT
========================================= */

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


    controls.appendChild(
        saveButton
    );


    controls.appendChild(
        cancelButton
    );


    editArea.appendChild(
        input
    );


    editArea.appendChild(
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


/* =========================================
   DELETE COMMENT
========================================= */

async function deleteComment(
    commentId
) {

    const confirmed =
        window.confirm(
            "Delete this comment?"
        );


    if (
        !confirmed
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


/* =========================================
   ADD COMMENT
========================================= */

async function addComment(
    mediaId,
    text,
    parentCommentId,
    inputElement,
    buttonElement
) {

    const commentText =
        text.trim();


    if (
        !commentText
    ) {

        return;
    }


    if (
        !currentUser
    ) {

        console.error(
            "No authenticated user."
        );


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


/* =========================================
   COMMENT AUTHOR
========================================= */

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

    if (
        !currentEditingMemory
    ) {

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

            `Delete "${memory.title}"?` +

            `\n\nThis will permanently delete the memory and all of its photos/videos.`

        );


    if (
        !confirmed
    ) {

        return;
    }


    try {

        /* GET MEDIA */

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


        /* DELETE STORAGE */

        if (

            mediaItems &&

            mediaItems.length > 0

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
        }


        /* DELETE COMMENTS */

        if (

            mediaItems &&

            mediaItems.length > 0

        ) {

            const mediaIdsForDelete =
                mediaItems.map(
                    (
                        item
                    ) =>
                        item.id
                );


            const {
                error:
                    commentsDeleteError
            } =
                await supabaseClient

                    .from(
                        "comments"
                    )

                    .delete()

                    .in(
                        "media_id",
                        mediaIdsForDelete
                    );


            if (
                commentsDeleteError
            ) {

                throw commentsDeleteError;
            }
        }


        /* DELETE MEDIA */

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


        /* DELETE MEMORY */

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

            day:
                "numeric",

            month:
                "long",

            year:
                "numeric"

        }
    );
}


/* =========================================
   ESCAPE HTML
========================================= */

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


/* =========================================
   EVENT LISTENERS
========================================= */

function setupEventListeners() {

    const memorySearchInput =
        document.getElementById(
            "memorySearchInput"
        );


    const clearSearchButton =
        document.getElementById(
            "clearSearchButton"
        );


    let searchTimeout =
        null;


    /* SEARCH */

    if (
        memorySearchInput
    ) {

        memorySearchInput.addEventListener(
            "input",
            () => {

                clearTimeout(
                    searchTimeout
                );


                const value =
                    memorySearchInput
                        .value
                        .trim();


                if (
                    clearSearchButton
                ) {

                    clearSearchButton.classList.toggle(

                        "hidden",

                        value.length ===
                            0

                    );
                }


                searchTimeout =
                    setTimeout(

                        async () => {

                            await loadMemories();

                        },

                        300

                    );
            }
        );
    }


    /* CLEAR SEARCH */

    if (
        clearSearchButton
    ) {

        clearSearchButton.addEventListener(
            "click",
            async () => {

                if (
                    memorySearchInput
                ) {

                    memorySearchInput.value =
                        "";
                }


                clearSearchButton.classList.add(
                    "hidden"
                );


                await loadMemories();


                if (
                    memorySearchInput
                ) {

                    memorySearchInput.focus();
                }
            }
        );
    }


    /* LOGOUT */

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    if (
        logoutButton
    ) {

        logoutButton.addEventListener(
            "click",
            logout
        );
    }


    /* OPEN UPLOAD */

    const openUploadButton =
        document.getElementById(
            "openUploadButton"
        );


    if (
        openUploadButton
    ) {

        openUploadButton.addEventListener(
            "click",
            openModal
        );
    }


    /* CLOSE UPLOAD */

    const closeUploadButton =
        document.getElementById(
            "closeUploadButton"
        );


    if (
        closeUploadButton
    ) {

        closeUploadButton.addEventListener(
            "click",
            closeModal
        );
    }


    /* CLICK OUTSIDE UPLOAD */

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


    /* DROP ZONE */

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

                if (
                    mediaInput
                ) {

                    mediaInput.click();
                }
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

    if (
        mediaInput
    ) {

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

    const saveMemoryButton =
        document.getElementById(
            "saveMemoryButton"
        );


    if (
        saveMemoryButton
    ) {

        saveMemoryButton.addEventListener(
            "click",
            createMemory
        );
    }


    /* EDIT MODAL */

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


    if (
        closeEditButton
    ) {

        closeEditButton.addEventListener(
            "click",
            (
                event
            ) => {

                event.preventDefault();


                closeEditModal();
            }
        );
    }


    if (
        saveEditButton
    ) {

        saveEditButton.addEventListener(
            "click",
            (
                event
            ) => {

                event.preventDefault();


                updateMemory();
            }
        );
    }


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


/* =========================================
   START APPLICATION
========================================= */

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


/* =========================================
   START
========================================= */

initializeApp();