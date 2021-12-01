
        this.txtArr = [];
        this.Fr = new FileReader();
        this.file = ("../../textFiles/scores.txt");

    
    onload(){
        //by lines
        var lines = this.result.split('');
        for (var line = 0; line < lines.length; line++){
            txtArr = [...this.txtArr, ...(lines[line].split(" "))];
        }
    }
    onloadend() {
        console.log(this.txtArr);
        document.getElementById('output').textContent=this.txtArr.join("");
        document.getElementById("output").innerHTML = this.txtArr[1]; 
        console.log(txtArr[1]);
        this.Fr.readAsText(this.file.files[0]);
      }

      
};