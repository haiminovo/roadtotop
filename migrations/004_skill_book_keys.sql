-- ============================================================
-- 修复初始技能书缺少 skill_key 的问题
-- ============================================================

UPDATE item SET skill_key='fireball' WHERE name='火球术秘籍' AND item_type='skill_book';
UPDATE item SET skill_key='heal' WHERE name='治愈术秘籍' AND item_type='skill_book';
UPDATE item SET skill_key='shield_bash' WHERE name='盾击秘籍' AND item_type='skill_book';
UPDATE item SET skill_key='poison_blade' WHERE name='毒刃秘籍' AND item_type='skill_book';
UPDATE item SET skill_key='lightning' WHERE name='闪电链秘籍' AND item_type='skill_book';
UPDATE item SET skill_key='backstab' WHERE name='背刺秘籍' AND item_type='skill_book';
