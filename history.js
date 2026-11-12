'use strict';
// The existing undo / redo arrays remain the only history stacks.
const HISTORY_LIMIT=70,HISTORY_BYTES=12*1024*1024;
let historyEdit=null;
function historySnapshot(){return{nails:clone(nails),selected,selectedIds:[...selectedIds],partId,activeLayerId,insideGroup,multiMode,tool,viewHand:handView}}
function historyDesign(state){return JSON.stringify(state.nails,(key,value)=>key==='collapsed'?undefined:value)}
function trimHistory(){while(undo.length>HISTORY_LIMIT)undo.shift();while(redo.length>HISTORY_LIMIT)redo.shift();let bytes=[...undo,...redo].reduce((sum,s)=>sum+JSON.stringify(s).length*2,0);while(bytes>HISTORY_BYTES&&(undo.length||redo.length)){const stack=undo.length?undo:redo;bytes-=JSON.stringify(stack.shift()).length*2}}
function restoreHistory(state){nails=clone(state.nails);selected=state.selected;lastFinger=selected;selectedIds=new Set(state.selectedIds);partId=state.partId;activeLayerId=state.activeLayerId;insideGroup=state.insideGroup;multiMode=state.multiMode;tool=state.tool;setHandView(state.viewHand||handView);renderTools();refresh()}
function beginHistory(owner='gesture'){if(historyEdit?.owner===owner)return;if(historyEdit)commitHistory();historyEdit={owner,before:historySnapshot()}}
function commitHistory(){if(!historyEdit)return false;const before=historyEdit.before;historyEdit=null;if(historyDesign(before)===historyDesign({nails})){refreshHistoryButtons();return false}undo.push(before);redo=[];trimHistory();refreshHistoryButtons();scheduleSave();return true}
function cancelHistory(){if(!historyEdit)return;const before=historyEdit.before;historyEdit=null;restoreHistory(before)}
checkpoint=function(){beginHistory()};
function stepHistory(forward){if(gesture)return;const focused=document.activeElement;if(focused?.matches?.('input[type=range],input[type=color]'))focused.blur();commitHistory();const source=forward?redo:undo,target=forward?undo:redo;if(!source.length)return;target.push(historySnapshot());const state=source.pop();trimHistory();restoreHistory(state);scheduleSave()}
function refreshHistoryButtons(){const pending=historyEdit&&historyDesign(historyEdit.before)!==historyDesign({nails});$('undo').disabled=!!gesture||(!undo.length&&!pending);$('redo').disabled=!!gesture||!!pending||!redo.length}
const refreshBeforeHistory=refresh;
refresh=function(){refreshBeforeHistory();refreshHistoryButtons()};
const startBeforeHistory=start,transformBeforeHistory=beginTransform;
start=function(e){startBeforeHistory(e);refreshHistoryButtons()};
beginTransform=function(kind,e){transformBeforeHistory(kind,e);refreshHistoryButtons()};
const saveBeforeHistory=saveProject;
saveProject=async function(explicit){if(gesture){scheduleSave();return}if(historyEdit){if(!explicit){scheduleSave();return}commitHistory()}return saveBeforeHistory(explicit)};
// One continuous pointer action is committed only on release; cancel rolls back.
const endBeforeHistory=end;
end=function(e){if(!gesture||gesture.id!==e.pointerId)return;if(gesture.kind==='marquee'){endBeforeHistory(e);return}gesture=null;if(e.type==='pointercancel')cancelHistory();else commitHistory();refresh()};
// Continuous controls share the same transaction mechanism as pointer gestures.
bindLiveSetting=function(id,field,key,defaults,after){const control=$(id);control.oninput=()=>{if(gesture)return;beginHistory(control);const n=currentNail();n[field]=n[field]||defaults(n);n[field][key]=control.type==='color'||control.tagName==='SELECT'?control.value:+control.value;if(after)after(n[field],key);refresh()};control.onchange=()=>{if(historyEdit?.owner!==control)control.oninput();commitHistory();refresh()};control.onblur=()=>{if(historyEdit?.owner===control)commitHistory()}};
const setupBeforeHistory=setup;
setup=function(){setupBeforeHistory();$('undo').onclick=()=>stepHistory(false);$('redo').onclick=()=>stepHistory(true);
 $('undo').setAttribute('aria-keyshortcuts','Control+Z Meta+Z');$('redo').setAttribute('aria-keyshortcuts','Control+Y Control+Shift+Z Meta+Y Meta+Shift+Z');
 // Wrap the existing range handlers rather than duplicate their mutations.
 for(const id of ['balance','angle','partSize','rotation','baseScale','baseX','baseY','baseRotation','baseOpacity']){const input=$(id),oldChange=input.onchange;const oldInline=input.oninput;input.oninput=e=>{if(gesture)return;beginHistory(input);if(oldInline)oldInline(e);if(oldChange)oldChange(e);else change(()=>currentNail()[id]=+input.value);refresh()};input.onchange=e=>{if(historyEdit?.owner!==input)input.oninput(e);commitHistory();refresh()};input.onblur=()=>{if(historyEdit?.owner===input)commitHistory()}}
 refreshHistoryButtons()};
// Existing change() calls inside range handlers join their parent's transaction.
change=function(fn){if(gesture)return;const continuous=historyEdit&&typeof historyEdit.owner==='object';if(!continuous)beginHistory('atomic');try{fn();refresh();if(!continuous)commitHistory()}catch(err){cancelHistory();throw err}};
// Capture phase prevents the older shortcut listener from firing a second time.
document.addEventListener('keydown',e=>{if(e.isComposing||e.altKey||!(e.ctrlKey||e.metaKey))return;const node=e.target;if(node?.closest?.('input:not([type=range]):not([type=color]):not([type=checkbox]),textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return;const key=e.key.toLowerCase(),forward=key==='y'||key==='z'&&e.shiftKey;if(key!=='z'&&key!=='y')return;e.preventDefault();e.stopImmediatePropagation();stepHistory(forward)},true);
// History is session-local; saved design formats and source IDs are unchanged.
// History bootstrap
// workspace.js starts the app after layout extensions have been installed.
