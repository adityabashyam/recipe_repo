const AWS = require('aws-sdk');

const quantity_units_enum = {
  oz : "oz",
  mg : "mg",
  g : "g",
  lb : "lb",
  // Volume Units
  ml : "ml",
  l : "l",
  fl_oz : "fl oz",
  tsp : "tsp",
  tbsp : "tbsp",
  cup : "cup",
  gal : "gal",
  // Ambiguous Units
  each: "each",
  piece: "piece",
  container: "container",
  package: "package",
  packet: "packet",
  pan: "pan"
}

const Recipe = {
  name: '',
  description: '',
  servingSizeValue: 0,
  servingSizeUnit: typeof quantity_units_enum,
  totalServings: 0,
  recipeInstructions: [],
  recipeIngredientGroups: [],
}





async function main(){
    // Set variables
    var credentials = new AWS.SharedIniFileCredentials({profile: 'default'});
    AWS.config.credentials = credentials;
    AWS.config.update({region:'us-east-1'});
    const bucket = 'banquet-recipes' // the s3 bucket name
    const photo  = 'recipe.png' // the name of file

    // Connect to Textract
    const client = new AWS.Textract();
    // Connect to S3 to display image
    const s3 = new AWS.S3();
    
    // Define paramaters
    const params = {
      Document: {
        S3Object: {
          Bucket: bucket,
          Name: photo
        },
      },
      FeatureTypes: ['TABLES', 'FORMS', 'LAYOUT']
    }

     
    try{
      const res = await client.analyzeDocument(params).promise();
      const blocks = res.Blocks;
      const cellBlocks = blocks.filter((blocks) => blocks.BlockType === "CELL");
      const blockMap = new Map(blocks.map(blocks => [blocks.Id, blocks])); 
      
      const extract = (cell) => {
        const extracted = [];
        if (cell.Relationships){
          cell.Relationships.forEach(rel=> {
          if (rel.Type === "CHILD") {
            rel.Ids.forEach(childId => {
              const childBlock = blockMap.get(childId);
              if (childBlock?.BlockType === "WORD" && childBlock.Text) {
                extracted.push(childBlock.Text);
              }
            });
          }
        });
      }
    return extracted.join(' ');
  };

      const json_converter = []
      let num_steps = 0;
      const recipe_prefix = ["0il", "oil", "canola", "Canola", "Pan Coating Spray", "pan coating spray", "Vegelene", "vegelene",  "peppers", "Peppers", "squash", "Squash", "Mushrooms", "mushroom", "egg", "Egg"]
      blocks?.forEach(block => {
        if (block.Text !== undefined){
        if((block.BlockType == "LINE")){
          if ((block.Relationships?.every(rel => rel.Type === "CHILD")) && (block.Text.split('.').length >2 || block.Text.trim().endsWith('.'))){
            const RecipeInstruction = {
              order: num_steps,
              recipe_arr: [block.Text] 
            }
            Recipe.recipeInstructions.push(RecipeInstruction);
            num_steps += 1; 
          }
          if ((block.Relationships?.every(rel => rel.Type === "CHILD")) && (block.Text.split(' ')[1]?.includes('Portion')|| block.Text.split(' ')[1]?.includes('Servings')) && (!isNaN(parseInt(block.Text.split(' ')[0])))){
            Recipe.servingSizeValue = block.Text.split(' ')[0];
            Recipe.servingSizeUnit = block.Text.split(' ')[1];
          }
        }
    }
    })


      cellBlocks.forEach(block => {
        const RecipeIngredientGroup = {
          recipe_quantity : 0,
          recipeQuantityUnit: 'oz',
          recipeIngredients: []
        }
        let block_extract = extract(block);
        let unit_enum = quantity_units_enum[block_extract.split(' ')[1]];
        let parsed = parseFloat(block_extract);

        if ((recipe_prefix.some(prefix => block_extract.includes(prefix)))){
          RecipeIngredientGroup.recipeIngredients.push(block_extract);
          RecipeIngredientGroup.recipeIngredients.push(parsed);
        }
        else if((unit_enum !== undefined)){
          RecipeIngredientGroup.recipeQuantityUnit = `${unit_enum}`;
          Recipe.recipeIngredientGroups.push(RecipeIngredientGroup);
          if (!isNaN(parsed)){
            RecipeIngredientGroup.recipe_quantity = parsed;
          }
        }   
      else{
        console.log('')
        
      }
      Recipe.recipeIngredientGroups.push(RecipeIngredientGroup);
    });
        console.log(JSON.stringify(Recipe, null, 2))
      }
    catch (err){
    console.error(err);}}

    
main()