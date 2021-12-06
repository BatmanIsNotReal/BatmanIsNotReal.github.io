import updateNode from "./updateNode.js";

export default class updateBox{
    constructor(maxUpdateNodes, updateNodesAmmount){
        this.maxUpdateNodes = maxUpdateNodes;
        this.updateNodesAmmount = updateNodesAmmount;
        this.Nodes = [];
    }

    townUpdatesAdd(textnode, document){
        if (this.updateNodesAmmount == this.maxUpdateNodes){
            let d = document.getElementById("townUpdates");
            let d_nested = document.getElementById(this.Nodes[1].id);
            d.removeChild(d_nested);
        }
        //add new node
        var newNode = new updateNode(textnode, this.Nodes.length - 1);
        this.Nodes.push(newNode);
        var node = document.createElement("LI");
        var text = document.createTextNode(this.Nodes[this.Nodes.length - 1].text);
        node.appendChild(text);
        document.getElementById("townUpdates").appendChild(node);
    }
}