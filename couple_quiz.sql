-- ============================================================
-- OUR LITTLE UNIVERSE
-- COUPLE QUIZ
-- Safe, isolated database layer
-- ============================================================

create table if not exists public.couple_quiz_questions (
    id uuid primary key default gen_random_uuid(),

    creator_id uuid not null
        references auth.users(id)
        on delete cascade,

    question_text text not null,

    options jsonb not null,

    correct_answers jsonb not null,

    is_answered boolean not null default false,

    answered_by uuid
        references auth.users(id)
        on delete set null,

    answered_at timestamptz,

    created_at timestamptz not null default now(),

    constraint couple_quiz_question_text_not_empty
        check (length(trim(question_text)) > 0),

    constraint couple_quiz_options_is_object
        check (jsonb_typeof(options) = 'object'),

    constraint couple_quiz_correct_answers_is_array
        check (jsonb_typeof(correct_answers) = 'array')
);


create table if not exists public.couple_quiz_attempts (
    id uuid primary key default gen_random_uuid(),

    question_id uuid not null
        references public.couple_quiz_questions(id)
        on delete cascade,

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    selected_answers jsonb not null,

    is_correct boolean not null,

    created_at timestamptz not null default now()
);


create index if not exists
couple_quiz_attempts_question_idx
on public.couple_quiz_attempts(question_id, created_at desc);


create index if not exists
couple_quiz_attempts_user_idx
on public.couple_quiz_attempts(user_id, created_at desc);


create unique index if not exists
couple_quiz_one_active_per_creator
on public.couple_quiz_questions(creator_id)
where is_answered = false;


-- ============================================================
-- EXISTING NOTIFICATIONS TABLE
-- ============================================================

alter table public.notifications
add column if not exists quiz_question_id uuid
references public.couple_quiz_questions(id)
on delete cascade;


create index if not exists
notifications_quiz_question_idx
on public.notifications(quiz_question_id);


-- ============================================================
-- RLS
--
-- The correct answer is intentionally NOT exposed through
-- ordinary SELECT policies. The frontend uses RPC functions.
-- ============================================================

alter table public.couple_quiz_questions
enable row level security;

alter table public.couple_quiz_attempts
enable row level security;


drop policy if exists
"couple_quiz_no_direct_question_select"
on public.couple_quiz_questions;


drop policy if exists
"couple_quiz_no_direct_question_insert"
on public.couple_quiz_questions;


drop policy if exists
"couple_quiz_no_direct_question_update"
on public.couple_quiz_questions;


drop policy if exists
"couple_quiz_no_direct_question_delete"
on public.couple_quiz_questions;


drop policy if exists
"couple_quiz_no_direct_attempt_select"
on public.couple_quiz_attempts;


drop policy if exists
"couple_quiz_no_direct_attempt_insert"
on public.couple_quiz_attempts;


-- ============================================================
-- GET STATE
--
-- Returns:
--   pending_question   = question created by the other user
--   my_active_question = question created by current user
--
-- correct_answers is NEVER returned.
-- ============================================================

create or replace function public.get_couple_quiz_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_pending jsonb;
    v_own jsonb;
begin

    v_user_id :=
        (select auth.uid());

    if v_user_id is null then
        raise exception 'Authentication required';
    end if;


    select
        jsonb_build_object(
            'id', q.id,
            'creator_id', q.creator_id,
            'question_text', q.question_text,
            'options', q.options,
            'created_at', q.created_at,
            'is_answered', q.is_answered,
            'answered_by', q.answered_by,
            'answered_at', q.answered_at
        )
    into v_pending

    from public.couple_quiz_questions q

    where q.is_answered = false
      and q.creator_id <> v_user_id

    order by q.created_at asc

    limit 1;


    select
        jsonb_build_object(
            'id', q.id,
            'creator_id', q.creator_id,
            'question_text', q.question_text,
            'options', q.options,
            'created_at', q.created_at,
            'is_answered', q.is_answered,
            'answered_by', q.answered_by,
            'answered_at', q.answered_at
        )
    into v_own

    from public.couple_quiz_questions q

    where q.is_answered = false
      and q.creator_id = v_user_id

    order by q.created_at desc

    limit 1;


    return jsonb_build_object(
        'pending_question',
        coalesce(v_pending, 'null'::jsonb),

        'my_active_question',
        coalesce(v_own, 'null'::jsonb)
    );

end;
$$;


-- ============================================================
-- CREATE QUESTION
--
-- One active question per creator.
-- ============================================================

create or replace function public.create_couple_quiz_question(
    p_question_text text,
    p_options jsonb,
    p_correct_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_question_id uuid;
    v_correct text;
    v_key text;
begin

    v_user_id :=
        (select auth.uid());

    if v_user_id is null then
        raise exception 'Authentication required';
    end if;


    if length(trim(coalesce(p_question_text, ''))) = 0 then
        raise exception 'Question cannot be empty';
    end if;


    if jsonb_typeof(p_options) <> 'object' then
        raise exception 'Options must be an object';
    end if;


    if jsonb_typeof(p_correct_answers) <> 'array' then
        raise exception 'Correct answers must be an array';
    end if;


    if (
        select count(*)
        from jsonb_object_keys(p_options)
    ) < 2 then
        raise exception 'At least two options are required';
    end if;


    if (
        select count(*)
        from jsonb_array_elements_text(p_correct_answers)
    ) < 1 then
        raise exception 'At least one correct answer is required';
    end if;


    if exists (
        select 1
        from public.couple_quiz_questions q
        where q.creator_id = v_user_id
          and q.is_answered = false
    ) then

        raise exception
            'You already have an unanswered question';

    end if;


    for v_correct in
        select value
        from jsonb_array_elements_text(
            p_correct_answers
        )
    loop

        if not (
            p_options ? v_correct
        ) then

            raise exception
                'A correct answer does not exist in the options';

        end if;

    end loop;


    insert into public.couple_quiz_questions (
        creator_id,
        question_text,
        options,
        correct_answers
    )
    values (
        v_user_id,
        trim(p_question_text),
        p_options,
        p_correct_answers
    )
    returning id into v_question_id;


    return v_question_id;

end;
$$;


-- ============================================================
-- SUBMIT ANSWER
--
-- Every attempt is stored.
-- Wrong attempt -> creator gets notification with selected text.
-- Correct attempt -> question becomes answered + creator notified.
-- ============================================================

create or replace function public.submit_couple_quiz_answer(
    p_question_id uuid,
    p_selected_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_question public.couple_quiz_questions%rowtype;

    v_selected_sorted jsonb;
    v_correct_sorted jsonb;

    v_is_correct boolean;

    v_selected_text text;
begin

    v_user_id :=
        (select auth.uid());

    if v_user_id is null then
        raise exception 'Authentication required';
    end if;


    select *
    into v_question

    from public.couple_quiz_questions

    where id = p_question_id

    for update;


    if v_question.id is null then
        raise exception 'Question not found';
    end if;


    if v_question.creator_id = v_user_id then
        raise exception 'You cannot answer your own question';
    end if;


    if v_question.is_answered then

        return jsonb_build_object(
            'success', true,
            'correct', true,
            'already_answered', true
        );

    end if;


    if jsonb_typeof(p_selected_answers) <> 'array' then
        raise exception 'Selected answers must be an array';
    end if;


    if (
        select count(*)
        from jsonb_array_elements_text(
            p_selected_answers
        )
    ) = 0 then
        raise exception 'Select at least one answer';
    end if;


    /*
     * Normalize both arrays so order doesn't matter.
     */

    select jsonb_agg(
        value
        order by value
    )
    into v_selected_sorted

    from jsonb_array_elements_text(
        p_selected_answers
    );


    select jsonb_agg(
        value
        order by value
    )
    into v_correct_sorted

    from jsonb_array_elements_text(
        v_question.correct_answers
    );


    v_is_correct :=
        v_selected_sorted =
        v_correct_sorted;


    /*
     * Store EVERY attempt.
     */

    insert into public.couple_quiz_attempts (
        question_id,
        user_id,
        selected_answers,
        is_correct
    )
    values (
        v_question.id,
        v_user_id,
        p_selected_answers,
        v_is_correct
    );


    /*
     * WRONG
     */

    if not v_is_correct then

        select string_agg(
            coalesce(
                v_question.options ->> value,
                value
            ),
            ', '
            order by value
        )
        into v_selected_text

        from jsonb_array_elements_text(
            p_selected_answers
        );


        insert into public.notifications (
            actor_id,
            recipient_id,
            notification_type,
            message,
            memory_id,
            media_id,
            comment_id,
            quiz_question_id,
            is_read
        )
        values (
            v_user_id,
            v_question.creator_id,
            'quiz_incorrect_answer',

            '💕 Your Couple Quiz question received an incorrect answer: '
            || coalesce(
                v_selected_text,
                'No answer selected'
            ),

            null,
            null,
            null,
            v_question.id,
            false
        );


        return jsonb_build_object(
            'success', true,
            'correct', false
        );

    end if;


    /*
     * CORRECT
     */

    update public.couple_quiz_questions

    set
        is_answered = true,
        answered_by = v_user_id,
        answered_at = now()

    where id = v_question.id;


    insert into public.notifications (
        actor_id,
        recipient_id,
        notification_type,
        message,
        memory_id,
        media_id,
        comment_id,
        quiz_question_id,
        is_read
    )
    values (
        v_user_id,
        v_question.creator_id,
        'quiz_answered',

        '💕 Your Couple Quiz question was answered correctly!',

        null,
        null,
        null,
        v_question.id,
        false
    );


    return jsonb_build_object(
        'success', true,
        'correct', true,
        'already_answered', false
    );

end;
$$;


-- ============================================================
-- GET QUESTION FOR NOTIFICATION
--
-- No correct answer is exposed.
-- Only users involved in the question can access it.
-- ============================================================

create or replace function public.get_couple_quiz_question(
    p_question_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_question public.couple_quiz_questions%rowtype;
begin

    v_user_id :=
        (select auth.uid());

    if v_user_id is null then
        raise exception 'Authentication required';
    end if;


    select *
    into v_question

    from public.couple_quiz_questions

    where id = p_question_id;


    if v_question.id is null then
        return null;
    end if;


    if
        v_question.creator_id <> v_user_id
        and
        v_question.answered_by <> v_user_id
    then

        raise exception
            'You are not part of this question';

    end if;


    return jsonb_build_object(
        'id', v_question.id,
        'creator_id', v_question.creator_id,
        'question_text', v_question.question_text,
        'options', v_question.options,
        'is_answered', v_question.is_answered,
        'answered_by', v_question.answered_by,
        'answered_at', v_question.answered_at,
        'created_at', v_question.created_at
    );

end;
$$;


-- ============================================================
-- GRANTS
-- ============================================================

grant execute
on function public.get_couple_quiz_state()
to authenticated;


grant execute
on function public.create_couple_quiz_question(
    text,
    jsonb,
    jsonb
)
to authenticated;


grant execute
on function public.submit_couple_quiz_answer(
    uuid,
    jsonb
)
to authenticated;


grant execute
on function public.get_couple_quiz_question(
    uuid
)
to authenticated;


-- ============================================================
-- NOTIFICATION TABLE:
-- Existing notification SELECT policy remains responsible for
-- showing the notification to its recipient.
--
-- If your existing table has no INSERT policy for clients,
-- that is fine: the SECURITY DEFINER RPC inserts notifications.
-- ============================================================
