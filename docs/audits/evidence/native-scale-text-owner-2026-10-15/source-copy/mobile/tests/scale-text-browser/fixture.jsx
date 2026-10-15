import {createRef, useCallback, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {FontScaleContext} from './rn-host-shim';
import {ScaleText} from '../../src/ScaleText';
import {AppHeader, PrimaryNavigation} from '../../src/AppChrome';

window.hostEvents = []; window.lastHostProps = {}; window.parentEvents = [];
const callbackEvents = [], objectRef = createRef();
function Fixture() {
  const [scale, setScale] = useState(1), [revision, setRevision] = useState(0),
    [draft, setDraft] = useState('Unsaved family enquiry'), [expanded, setExpanded] = useState(false),
    [selected, setSelected] = useState('Hellenic Bakery & Grocery'), [route, setRoute] = useState('discover');
  const camera = useRef({longitude: -83.373, latitude: 42.425, zoom: 14});
  const callback = useCallback(node => {callbackEvents.push(node);}, []);
  useEffect(() => {window.parentEvents.push('mount');return () => {window.parentEvents.push('unmount');};}, []);
  window.scaleFixture = {
    setScale, rerender: () => setRevision(v => v + 1),
    state: () => ({draft, expanded, selected, route, camera: camera.current, revision}),
    objectRef: () => objectRef.current, callbackEvents: () => callbackEvents,
  };
  return <FontScaleContext.Provider value={scale}>
    <AppHeader onHome={() => setRoute('home')} onAccount={() => setRoute('grow')}/>
    <main>
      <ScaleText ref={objectRef} testID="object-ref" accessibilityRole="header" accessibilityLabel="Selected place" style={{fontSize: 18}}>{selected}</ScaleText>
      <ScaleText ref={callback} testID="callback-ref" selectable accessibilityLabel="Editable copy" onPress={() => setSelected('Explicitly selected place')} style={{fontSize: 16}}>A family table <ScaleText testID="nested" style={{fontWeight: '700'}}>with room for everyone</ScaleText></ScaleText>
      <ScaleText testID="explicit-props" allowFontScaling={false} maxFontSizeMultiplier={1.5} numberOfLines={2} accessibilityHint="Caller supplied hint">Caller controlled text properties</ScaleText>
      <label>Unsaved enquiry <input data-testid="draft-input" value={draft} onChange={event => setDraft(event.target.value)}/></label>
      <button onClick={() => setExpanded(value => !value)}>{expanded ? 'Close expanded map' : 'Expand map'}</button>
      <div data-testid="retained-map" data-camera={JSON.stringify(camera.current)}>Retained map host</div>
    </main>
    <PrimaryNavigation activeId={route} onNavigate={setRoute}/>
  </FontScaleContext.Provider>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
