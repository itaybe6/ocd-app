const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');

const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
const flatten = style => Object.assign({}, ...(Array.isArray(style) ? style : [style]));

function setup(width, isSubscriber = false) {
  const r = runtime();
  let presses = 0;
  const { OcdPlusHomeBanner } = r.load('src/components/OcdPlusHomeBanner.tsx', {
    'react-native': { Image: 'Image', Pressable: 'Button', View: 'View', Text: 'Text', StyleSheet: { create: x => x, absoluteFill: {} } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-svg': { default: 'Svg', Defs: 'Defs', Ellipse: 'Ellipse', RadialGradient: 'RadialGradient', Stop: 'Stop' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'react-native-reanimated': { default: { View: 'AnimatedView' }, useReducedMotion: () => true },
    '../../assets/ocdplus-membership-card-cutout.png': { width: 720, height: 480 },
    './OcdPlusProductPriceBlock': { OCD_PLUS_DISCOUNT: 0.08, OCD_PLUS_FREE_SHIPPING_AT: 149 },
    './OcdPlusMark': { OcdPlusMark: 'BrandMark' },
    '../hooks/useMembershipCardFloat': { useMembershipCardFloat: () => ({ style: {}, onLayout() {}, onLoad() {}, reducedMotion: true }) },
  });
  r.mount(() => OcdPlusHomeBanner({ width, isSubscriber, onPress: () => presses++ }));
  return { r, all: nodes(r.tree()), presses: () => presses };
}

test('large local asset cannot impose its intrinsic height on a phone or tablet banner', () => {
  for (const screenWidth of [320, 360, 390, 430, 768]) {
    const width = screenWidth;
    const s = setup(width);
    const image = s.all.find(node => node.type === 'Image');
    // Native Image starts with the bundled asset's intrinsic width/height.
    const resolved = { ...image.props.source, ...flatten(image.props.style) };
    assert.equal(typeof resolved.width, 'number');
    assert.equal(typeof resolved.height, 'number');
    assert.ok(resolved.height < 160, 'source height must never stretch the row');
    assert.ok(Math.abs(resolved.width / resolved.height - 720 / 480) < 0.001);
    // Transparent padding leaves all card edges inside the artwork column.
    const artwork = s.all.find(node => node.props.children?.includes(image));
    assert.ok(resolved.width * 0.85 < flatten(artwork.props.style).width);
    const body = s.all.find(node => node.props.children?.includes(artwork));
    assert.equal(body.props.style.flexDirection, 'column');
    assert.equal(body.props.style.alignItems, 'center');
    assert.equal(flatten(artwork.props.style).alignItems, 'center');
    const subtitle = s.all.find(node => node.props.children?.includes('גישה ראשונה להשקות ומבצעים,\nושירות מועדף לחברי OCD+.'));
    assert.equal(subtitle.props.style.textAlign, 'center');
    s.r.unmount();
  }
});

test('membership and join banners preserve the existing action and reduced-motion setting', () => {
  for (const member of [false, true]) {
    const s = setup(366, member);
    assert.equal(s.r.tree().props.entering, undefined);
    const button = s.all.find(node => node.type === 'Button');
    button.props.onPress();
    assert.equal(s.presses(), 1);
    assert.ok(s.all.some(node => node.props.children?.includes(member ? 'למועדון שלי' : 'להכיר את OCD+')));
    s.r.unmount();
  }
});

test('raised card is not clipped and has reserved space inside the touch target', () => {
  for (const width of [296, 366, 744]) {
    const s = setup(width, true);
    const image = s.all.find(node => node.type === 'Image');
    const imageStyle = flatten(image.props.style);
    const lift = -imageStyle.transform[0].translateY;
    assert.ok(lift > 0 && lift < imageStyle.height, 'only part of the card is raised');
    let child = image;
    while (child !== s.r.tree()) {
      const parent = s.all.find(node => node.props.children?.includes(child));
      assert.ok(parent);
      assert.notEqual(flatten(parent.props.style).overflow, 'hidden', 'no ancestor clips the raised card');
      child = parent;
    }
    const button = s.all.find(node => node.type === 'Button');
    assert.ok(button.props.style.paddingTop >= lift - 20, 'reserve space above the surface for the raised artwork');
    s.r.unmount();
  }
});
