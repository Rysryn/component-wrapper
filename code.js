// code.js (Plugin Logic)
figma.showUI(__html__, { width: 360, height: 520 });

let selectedMainComponent = null;
let selectedFramesToModify = [];
let currentStep = 0;

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'cancel') {
    figma.closePlugin();
  } 
  else if (msg.type === 'startStep1') {
    currentStep = 1;
    figma.notify("Select a component/frame to add to your frames");
    figma.ui.postMessage({ type: 'updateStep', step: 1 });
    const selection = await figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.notify("Please select a component or frame first");
      return;
    }
    
    selectedMainComponent = selection[0];
    figma.ui.postMessage({ 
      type: 'componentSelected', 
      name: selectedMainComponent.name 
    });
  }
  else if (msg.type === 'startStep2') {
    currentStep = 2;
    figma.notify("Now select the frames you want to modify");
    figma.ui.postMessage({ type: 'updateStep', step: 2 });
    
    const selection = await figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Please select at least one frame to modify");
      return;
    }
    
    selectedFramesToModify = selection.filter(node => 
      node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE");
    
    figma.ui.postMessage({ 
      type: 'framesSelected', 
      count: selectedFramesToModify.length 
    });
  }
  else if (msg.type === 'applyChanges') {
    try {
      await applyChangesToFrames(msg.config);
      figma.notify("Changes applied successfully!");
      figma.ui.postMessage({ type: 'updateStep', step: 3 });
    } catch (error) {
      figma.notify("Error: " + error.message);
      console.error(error);
    }
  }
  else if (msg.type === 'reset') {
    selectedMainComponent = null;
    selectedFramesToModify = [];
    currentStep = 0;
    figma.ui.postMessage({ type: 'updateStep', step: 0 });
  }
};

async function applyChangesToFrames(config) {
  if (!selectedMainComponent || selectedFramesToModify.length === 0) {
    throw new Error("Please complete both selection steps first");
  }
  
  // Sort frames from left to right, then top to bottom
  selectedFramesToModify.sort((a, b) => {
    // If y positions are close enough (within same row)
    if (Math.abs(a.y - b.y) < 20) {
      return a.x - b.x; // Sort by x (left to right)
    }
    return a.y - b.y; // Sort by y (top to bottom)
  });
  
  // For each frame, create a new parent frame with auto layout
  for (let i = 0; i < selectedFramesToModify.length; i++) {
    const frame = selectedFramesToModify[i];
    
    // Create a parent frame
    const parentFrame = figma.createFrame();
    parentFrame.name = `Frame ${i + 1}`;
    parentFrame.x = frame.x;
    parentFrame.y = frame.y;
    parentFrame.resize(frame.width + config.padding * 2, frame.height + config.padding * 2);
    
    // Set up auto layout
    parentFrame.layoutMode = config.direction === 'HORIZONTAL' ? 'HORIZONTAL' : 'VERTICAL';
    parentFrame.primaryAxisAlignItems = 'CENTER';
    parentFrame.counterAxisAlignItems = 'CENTER';
    parentFrame.itemSpacing = config.gap;
    parentFrame.paddingLeft = config.padding;
    parentFrame.paddingRight = config.padding;
    parentFrame.paddingTop = config.padding;
    parentFrame.paddingBottom = config.padding;
    
    // Clone the original component
    const componentClone = selectedMainComponent.clone();
    
    // Put the selected frame inside the parent frame
    frame.parent.insertChild(frame.parent.children.indexOf(frame), parentFrame);
    
    // Add the original frame to the parent frame
    parentFrame.appendChild(frame);
    
    // Add the component based on position setting
    switch (config.position) {
      case 'top':
        parentFrame.insertChild(0, componentClone);
        break;
      case 'right':
        parentFrame.appendChild(componentClone);
        break;
      case 'bottom':
        parentFrame.appendChild(componentClone);
        break;
      case 'left':
        parentFrame.insertChild(0, componentClone);
        break;
    }
    
    // Reset position of the frame inside parent
    frame.x = 0;
    frame.y = 0;
  }

  // Reorder in the layer panel
  figma.currentPage.selection = [];
}