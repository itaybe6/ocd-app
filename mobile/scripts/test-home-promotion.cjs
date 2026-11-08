const test = require('node:test');
const assert = require('node:assert/strict');
const { runtime } = require('./helpers/hook-runtime.cjs');
test('Vitro promotion opens the dedicated 99-shekel triple pack and keeps its accessible offer', () => {
  const h=runtime(), routes=[];
  const {HomePromotionBanner,VITRO_TRIO_HANDLE}=h.load('src/components/HomePromotionBanner.tsx',{
    'react-native': {View:'View',Image:'Image',Text:'Text',Pressable:'Button',StyleSheet:{create:x=>x}},
    'lucide-react-native': {ArrowLeft:'Arrow'},
    '../navigation/navigationRef': {safeNavigate:(...args)=>routes.push(args)},
    '../../assets/vitro-trio-editorial-v2.jpg': {width:1200,height:600},
  });
  h.mount(()=>HomePromotionBanner());
  assert.equal(h.tree().props.accessibilityRole,'button');
  assert.match(h.tree().props.accessibilityLabel,/99/);
  assert.match(h.tree().props.accessibilityLabel,/750/);
  h.tree().props.onPress();
  assert.equal(VITRO_TRIO_HANDLE,'מארז-3-ויטרו-750-מל-רק-ב-99-שח');
  assert.deepEqual(JSON.parse(JSON.stringify(routes)),[['Product',{handle:VITRO_TRIO_HANDLE}]]);
  h.unmount();
});
