-- Local demo seed: applied automatically on supabase db reset.
do $$
declare
  v_author  uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  v_subject uuid := 'aaaaaaaa-0000-4000-8000-000000000010';

  -- guide bases / guides / revisions (index 1..5)
  gb uuid[] := array[
    'aaaaaaaa-0000-4000-8000-000000000101',
    'aaaaaaaa-0000-4000-8000-000000000102',
    'aaaaaaaa-0000-4000-8000-000000000103',
    'aaaaaaaa-0000-4000-8000-000000000104',
    'aaaaaaaa-0000-4000-8000-000000000105'
  ];
  gd uuid[] := array[
    'aaaaaaaa-0000-4000-8000-000000000201',
    'aaaaaaaa-0000-4000-8000-000000000202',
    'aaaaaaaa-0000-4000-8000-000000000203',
    'aaaaaaaa-0000-4000-8000-000000000204',
    'aaaaaaaa-0000-4000-8000-000000000205'
  ];
  gr uuid[] := array[
    'aaaaaaaa-0000-4000-8000-000000000301',
    'aaaaaaaa-0000-4000-8000-000000000302',
    'aaaaaaaa-0000-4000-8000-000000000303',
    'aaaaaaaa-0000-4000-8000-000000000304',
    'aaaaaaaa-0000-4000-8000-000000000305'
  ];
  titles text[] := array[
    'Intro to Game Engines',
    'Setting Up Your Project',
    'Sprites and Assets',
    'Player Movement and Physics',
    'Shipping Your First Game'
  ];
  slugs text[] := array[
    'intro-to-game-engines',
    'setting-up-your-project',
    'sprites-and-assets',
    'player-movement-and-physics',
    'shipping-your-first-game'
  ];
  summaries text[] := array[
    'What a game engine actually does, and how to choose one.',
    'Create a project, organise folders, and run your first empty scene.',
    'Import sprites, build a tileset, and keep your assets tidy.',
    'Move a character with input, gravity, and simple collisions.',
    'Package a build, test it, and put your game in front of players.'
  ];
  kinds public.knowledge_type[] := array[
    'theoretical','practical','practical','practical','practical'
  ]::public.knowledge_type[];
  -- word counts -> reading minutes at 200 wpm: 2, 3, 4, 5, 6
  word_counts int[] := array[400, 600, 800, 1000, 1200];

  v_objective uuid := 'aaaaaaaa-0000-4000-8000-000000000020';
  v_orev      uuid := 'aaaaaaaa-0000-4000-8000-000000000021';
  node_ids uuid[] := array[
    'aaaaaaaa-0000-4000-8000-000000000401',
    'aaaaaaaa-0000-4000-8000-000000000402',
    'aaaaaaaa-0000-4000-8000-000000000403',
    'aaaaaaaa-0000-4000-8000-000000000404',
    'aaaaaaaa-0000-4000-8000-000000000405'
  ];
  i int;
begin
  -- Clear prior demo rows (children cascade off these).
  delete from public.objectives where id = v_objective;
  delete from public.guide_bases where id = any(gb);
  delete from public.subjects where id = v_subject;

  -- Author/curator. The on_auth_user_created trigger creates the profile.
  if not exists (select 1 from auth.users where id = v_author) then
    insert into auth.users (id, email, raw_user_meta_data, aud, role)
    values (
      v_author,
      'bluelearn-demo@example.com',
      '{"username":"bluelearn"}'::jsonb,
      'authenticated',
      'authenticated'
    );
  end if;

  insert into public.subjects (id, slug, name, summary, creator_id)
  values (
    v_subject,
    'game-development',
    'Game Development',
    'Build games from first principles: engines, assets, gameplay, and shipping.',
    v_author
  );

  -- Five published guides tagged with the subject.
  for i in 1..5 loop
    insert into public.guide_bases (id, slug, title, knowledge_type, status)
    values (gb[i], slugs[i], titles[i], kinds[i], 'published');

    insert into public.guides (id, guide_base_id, author_id, slug, status)
    values (gd[i], gb[i], v_author, 'main', 'published');

    insert into public.guide_revisions
      (id, guide_id, title, summary, body, status, author_id, approved_at)
    values (
      gr[i], gd[i], titles[i], summaries[i],
      rtrim(repeat('word ', word_counts[i])),
      'submitted', v_author, now()
    );

    update public.guides set current_revision_id = gr[i] where id = gd[i];
    update public.guide_bases set canonical_guide_id = gd[i] where id = gb[i];

    insert into public.guide_revision_subjects (guide_revision_id, subject_id)
    values (gr[i], v_subject);
  end loop;

  -- A linear objective over the five guides, tagged with the subject.
  insert into public.objectives (id, slug, created_by, status, current_revision_id)
  values (v_objective, 'build-your-first-2d-game', v_author, 'published', v_orev);

  insert into public.objective_revisions
    (id, objective_id, title, summary, author_id, status, published_at)
  values (
    v_orev, v_objective,
    'Build Your First 2D Game',
    'A guided path from an empty project to a shipped 2D game.',
    v_author, 'published', now()
  );

  -- Nodes: the fifth guide is the featured target; all are included.
  for i in 1..5 loop
    insert into public.objective_revision_nodes
      (id, revision_id, guide_base_id, guide_id, is_target, is_featured)
    values (node_ids[i], v_orev, gb[i], gd[i], i = 5, i = 5);
  end loop;

  insert into public.objective_revision_subjects (objective_revision_id, subject_id)
  values (v_orev, v_subject);

  -- Curator placement under the featured target: guides 1..5 in order. The card
  -- shows the last three and collapses the first two into "2 more guides".
  for i in 1..5 loop
    insert into public.objective_revision_node_orders
      (revision_id, target_node_id, node_id, position)
    values (v_orev, node_ids[5], node_ids[i], i - 1);
  end loop;
end $$;
